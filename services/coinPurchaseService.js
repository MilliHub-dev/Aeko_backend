import { prisma } from "../config/db.js";
import { getCoinPackageById } from "../config/giftCatalog.js";
import { createCheckout, isWhopConfigured } from "./whopService.js";
import {
  claimTransactionForFulfilment,
  confirmWhopTransaction,
} from "./whopPaymentConfirmation.js";

/**
 * Coin purchases, charged through Whop.
 *
 * A purchase is a row in the shared `transactions` table (no planId, no
 * communityId, metadata.type = "coin_purchase") rather than a table of its
 * own. That reuses the Whop webhook's metadata → transactionId mapping, and
 * gives fulfilment a row to lock, which the old Paystack/Stripe routes lacked:
 * they checked the coin ledger for the reference and then wrote, so two
 * simultaneous verify calls could both credit.
 *
 * Coins are credited only from the server's own package catalogue. The
 * amount in metadata is informational; it is never trusted to decide how many
 * coins someone gets.
 */

export const COIN_PURCHASE_TYPE = "coin_purchase";
const REFERENCE_PREFIX = "COINS-";

const httpError = (message, statusCode) =>
  Object.assign(new Error(message), { statusCode });

/**
 * The reference prefix is a fallback for a row whose metadata was ever
 * replaced wholesale, so such a payment is still recognised and fulfilled.
 */
export const isCoinPurchaseTransaction = (transaction) =>
  transaction?.metadata?.type === COIN_PURCHASE_TYPE ||
  String(transaction?.paymentReference ?? "").startsWith(REFERENCE_PREFIX);

/**
 * Creates a pending purchase and a Whop checkout for it.
 * @returns {Promise<{reference: string, authorizationUrl: string, package: object}>}
 */
export const initializeCoinPurchase = async ({ userId, packageId }) => {
  const pkg = getCoinPackageById(packageId);
  if (!pkg) throw httpError("Invalid package", 400);

  if (!isWhopConfigured()) {
    throw httpError("Coin purchases are temporarily unavailable", 503);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!user) throw httpError("User not found", 404);

  const reference = `${REFERENCE_PREFIX}${Date.now()}-${userId.substring(0, 6)}`;

  const transaction = await prisma.transaction.create({
    data: {
      userId,
      amount: pkg.priceUSD,
      currency: "USD",
      paymentMethod: "whop",
      paymentReference: reference,
      status: "pending",
      metadata: {
        type: COIN_PURCHASE_TYPE,
        packageId: pkg.id,
        coins: pkg.coins,
      },
    },
  });

  // Echoed back on the webhook. Strings only, matching the shape the
  // subscription checkout already sends successfully.
  const metadata = {
    type: COIN_PURCHASE_TYPE,
    transactionId: transaction.id,
    reference,
    userId,
    packageId: pkg.id,
    coins: String(pkg.coins),
  };

  try {
    const { purchaseUrl, sessionId, planId, raw } = await createCheckout({
      amount: pkg.priceUSD,
      currency: "usd",
      title: `Aeko — ${pkg.label}`,
      metadata,
      returnUrl: process.env.FRONTEND_URL
        ? `${process.env.FRONTEND_URL}/coins/callback`
        : undefined,
    });

    // Persisted before the URL check, so a renamed field is diagnosable.
    await prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        providerResponse: raw ?? undefined,
        metadata: {
          ...metadata,
          coins: pkg.coins,
          whopSessionId: sessionId ?? undefined,
          whopPlanId: planId ?? undefined,
        },
      },
    });

    if (!purchaseUrl) throw new Error("Whop did not return a checkout URL");

    return { reference, authorizationUrl: purchaseUrl, package: pkg };
  } catch (error) {
    console.error("Whop coin checkout error:", error.response || error.message);
    await prisma.transaction.update({
      where: { id: transaction.id },
      data: { status: "failed", failureReason: error.message },
    });
    throw httpError("Failed to start checkout. Please try again.", 502);
  }
};

/**
 * Credits the coins for a paid purchase, exactly once.
 *
 * The claim, the balance increment and the ledger row commit together, so a
 * replayed webhook or a verify racing the webhook finds the transaction
 * already completed and credits nothing. `increment` rather than read-add-
 * write, so a concurrent gift debit on the same user is not overwritten.
 */
export const handleCoinPurchaseSuccess = async (transactionId) => {
  const existing = await prisma.transaction.findUnique({
    where: { id: transactionId },
    select: { id: true },
  });
  if (!existing) throw new Error("Transaction not found");

  return prisma.$transaction(
    async (tx) => {
      const claimed = await claimTransactionForFulfilment(tx, transactionId);
      if (!claimed) {
        return {
          success: true,
          alreadyProcessed: true,
          message: "Transaction already processed",
        };
      }

      const transaction = await tx.transaction.findUnique({
        where: { id: transactionId },
      });
      const metadata = transaction.metadata || {};
      const pkg = getCoinPackageById(metadata.packageId);

      if (!pkg) {
        // Throwing rolls back the claim, so the payment stays fulfillable once
        // the catalogue is fixed, and the webhook's retry will pick it up.
        throw new Error(
          `Coin purchase ${transactionId} references unknown package ${metadata.packageId}`,
        );
      }

      const user = await tx.user.update({
        where: { id: transaction.userId },
        data: { coinBalance: { increment: pkg.coins } },
        select: { coinBalance: true },
      });

      await tx.coinTransaction.create({
        data: {
          userId: transaction.userId,
          type: "purchase",
          amount: pkg.coins,
          balanceAfter: user.coinBalance,
          description: `Purchased ${pkg.label}`,
          metadata: {
            packageId: pkg.id,
            reference: transaction.paymentReference,
            transactionId,
            paymentMethod: "whop",
            whopPaymentId: metadata.whopPaymentId ?? null,
          },
        },
      });

      return { success: true, coins: pkg.coins, coinBalance: user.coinBalance };
    },
    { timeout: 15000 },
  );
};

/**
 * Confirms the caller's own purchase and credits it if it has cleared.
 *
 * Scoped to the user: a reference alone must not reveal someone else's
 * balance, which the old unauthenticated Paystack verify route did.
 */
export const verifyCoinPurchase = async ({ reference, userId }) => {
  const transaction = await prisma.transaction.findFirst({
    where: { paymentReference: reference, userId },
  });
  if (!transaction || !isCoinPurchaseTransaction(transaction)) {
    throw httpError("Purchase not found", 404);
  }

  const balance = async () =>
    (
      await prisma.user.findUnique({
        where: { id: userId },
        select: { coinBalance: true },
      })
    )?.coinBalance ?? 0;

  if (transaction.status === "completed") {
    return {
      success: true,
      pending: false,
      alreadyProcessed: true,
      message: "Coins already credited",
      coinBalance: await balance(),
    };
  }

  const confirmation = await confirmWhopTransaction(transaction);
  if (!confirmation.success) return confirmation;

  const fulfilled = await handleCoinPurchaseSuccess(transaction.id);

  return {
    success: true,
    pending: false,
    message: "Coins credited successfully",
    coins: fulfilled.coins,
    coinBalance: fulfilled.coinBalance ?? (await balance()),
  };
};

export default {
  initializeCoinPurchase,
  handleCoinPurchaseSuccess,
  verifyCoinPurchase,
  isCoinPurchaseTransaction,
};
