import { createHash } from "crypto";
import bs58 from "bs58";
import { v4 as uuidV4 } from "uuid";
import { prisma } from "../config/db.js";
import {
  coinsToCents,
  minWithdrawCoins,
  WITHDRAW_CENTS_PER_100_COINS,
  WITHDRAW_FEE_CENTS,
  WITHDRAW_MIN_CENTS,
  WITHDRAW_NETWORKS,
} from "../config/withdrawalConfig.js";
import { GiftError as WithdrawalError } from "./giftLedger.js";
import { createNotification } from "./notificationService.js";

/**
 * Coin withdrawals, paid out manually.
 *
 * A request holds the coins immediately (so they cannot also be spent or
 * requested twice) and waits for an admin. The admin either marks it paid with
 * the on-chain transaction hash, or rejects it, which returns the coins.
 *
 * Only earned coins are withdrawable: `earnedCoinBalance` rises when a gift is
 * received, and the withdrawable amount is the lower of that and the total
 * balance, so coins bought with a card can never leave as crypto.
 */

export { WithdrawalError };

const NETWORK_IDS = new Set(WITHDRAW_NETWORKS.map((n) => n.id));

const withdrawalSelect = {
  id: true,
  coins: true,
  network: true,
  walletAddress: true,
  grossUsdCents: true,
  feeUsdCents: true,
  payoutUsdCents: true,
  status: true,
  txHash: true,
  adminNote: true,
  createdAt: true,
  processedAt: true,
};

/** ed25519 public key in base58: the format of both AEKO and Solana wallets. */
const isEd25519Address = (address) => {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) return false;
  try {
    return bs58.decode(address).length === 32;
  } catch {
    return false;
  }
};

/** Tron base58check: 0x41 version byte + 20-byte account + 4-byte checksum. */
const isTronAddress = (address) => {
  if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)) return false;
  try {
    const bytes = Buffer.from(bs58.decode(address));
    if (bytes.length !== 25 || bytes[0] !== 0x41) return false;
    const body = bytes.subarray(0, 21);
    const checksum = createHash("sha256")
      .update(createHash("sha256").update(body).digest())
      .digest()
      .subarray(0, 4);
    return checksum.equals(bytes.subarray(21));
  } catch {
    return false;
  }
};

export const isValidWithdrawalAddress = (network, address) => {
  if (typeof address !== "string") return false;
  const trimmed = address.trim();
  if (network === "USDT_TRC20") return isTronAddress(trimmed);
  if (network === "AEKO" || network === "SOL") return isEd25519Address(trimmed);
  return false;
};

const withdrawableOf = (user) =>
  Math.max(0, Math.floor(Math.min(user?.coinBalance ?? 0, user?.earnedCoinBalance ?? 0)));

export const getWithdrawalInfo = async (userId, db = prisma) => {
  const [user, pending] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: { coinBalance: true, earnedCoinBalance: true },
    }),
    db.coinWithdrawal.findFirst({
      where: { userId, status: "pending" },
      select: withdrawalSelect,
    }),
  ]);

  const withdrawableCoins = withdrawableOf(user);
  return {
    coinBalance: user?.coinBalance ?? 0,
    earnedCoinBalance: user?.earnedCoinBalance ?? 0,
    withdrawableCoins,
    withdrawableUsdCents: coinsToCents(withdrawableCoins),
    usdPer100Coins: WITHDRAW_CENTS_PER_100_COINS / 100,
    feeUsdCents: WITHDRAW_FEE_CENTS,
    minUsdCents: WITHDRAW_MIN_CENTS,
    minCoins: minWithdrawCoins(),
    networks: WITHDRAW_NETWORKS,
    pendingWithdrawal: pending,
  };
};

export const listWithdrawals = async (userId, { page = 1, limit = 20 } = {}, db = prisma) => {
  const take = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);
  const current = Math.max(parseInt(page, 10) || 1, 1);
  const [withdrawals, total] = await Promise.all([
    db.coinWithdrawal.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip: (current - 1) * take,
      take,
      select: withdrawalSelect,
    }),
    db.coinWithdrawal.count({ where: { userId } }),
  ]);
  return { withdrawals, total, page: current, limit: take };
};

/**
 * @param {object} params
 * @param {object} [db] Prisma client; injectable for tests.
 */
export const requestWithdrawal = async ({ userId, coins, network, walletAddress }, db = prisma) => {
  const amount = Number(coins);
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new WithdrawalError(400, "INVALID_AMOUNT", "Enter a whole number of coins");
  }
  if (!NETWORK_IDS.has(network)) {
    throw new WithdrawalError(400, "INVALID_NETWORK", "Choose AEKO, USDT (TRC20) or Solana");
  }
  if (!isValidWithdrawalAddress(network, walletAddress)) {
    throw new WithdrawalError(400, "INVALID_ADDRESS", "That wallet address isn't valid for this network");
  }

  const grossUsdCents = coinsToCents(amount);
  if (grossUsdCents < WITHDRAW_MIN_CENTS) {
    throw new WithdrawalError(400, "BELOW_MINIMUM", "This is below the minimum withdrawal", {
      minCoins: minWithdrawCoins(),
      minUsdCents: WITHDRAW_MIN_CENTS,
    });
  }
  const payoutUsdCents = grossUsdCents - WITHDRAW_FEE_CENTS;

  return db.$transaction(
    async (tx) => {
      const pending = await tx.coinWithdrawal.findFirst({
        where: { userId, status: "pending" },
        select: withdrawalSelect,
      });
      if (pending) {
        throw new WithdrawalError(409, "PENDING_EXISTS", "You already have a withdrawal waiting for review", {
          pendingWithdrawal: pending,
        });
      }

      // Both balances in one conditional statement: the check and the hold
      // cannot be separated by a concurrent gift, purchase or second request.
      const held = await tx.user.updateMany({
        where: {
          id: userId,
          coinBalance: { gte: amount },
          earnedCoinBalance: { gte: amount },
        },
        data: {
          coinBalance: { decrement: amount },
          earnedCoinBalance: { decrement: amount },
        },
      });
      if (held.count === 0) {
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { coinBalance: true, earnedCoinBalance: true },
        });
        throw new WithdrawalError(400, "INSUFFICIENT_WITHDRAWABLE", "You don't have enough earned coins", {
          withdrawableCoins: withdrawableOf(user),
        });
      }

      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { coinBalance: true, earnedCoinBalance: true },
      });

      const withdrawal = await tx.coinWithdrawal.create({
        data: {
          id: uuidV4(),
          userId,
          coins: amount,
          network,
          walletAddress: walletAddress.trim(),
          grossUsdCents,
          feeUsdCents: WITHDRAW_FEE_CENTS,
          payoutUsdCents,
          status: "pending",
        },
        select: withdrawalSelect,
      }).catch((error) => {
        // The one-pending-per-user index: a request that raced past the check above.
        if (error?.code === "P2002") {
          throw new WithdrawalError(409, "PENDING_EXISTS", "You already have a withdrawal waiting for review");
        }
        throw error;
      });

      await tx.coinTransaction.create({
        data: {
          id: uuidV4(),
          userId,
          type: "withdrawal",
          amount: -amount,
          balanceAfter: user.coinBalance,
          description: `Withdrawal request: ${amount} coins to ${network}`,
          metadata: { withdrawalId: withdrawal.id, network, payoutUsdCents },
        },
      });

      return {
        withdrawal,
        coinBalance: user.coinBalance,
        withdrawableCoins: withdrawableOf(user),
      };
    },
    { maxWait: 10000, timeout: 20000 }
  );
};

const notifyWithdrawal = (withdrawal, userId) =>
  Promise.resolve(
    createNotification({
      recipientId: userId,
      type: "WITHDRAWAL",
      title: withdrawal.status === "paid" ? "Withdrawal paid" : "Withdrawal rejected",
      message:
        withdrawal.status === "paid"
          ? `Your withdrawal of $${(withdrawal.payoutUsdCents / 100).toFixed(2)} has been sent.`
          : `Your withdrawal was rejected and ${withdrawal.coins} coins were returned.${
              withdrawal.adminNote ? ` Reason: ${withdrawal.adminNote}` : ""
            }`,
      entityId: withdrawal.id,
      entityType: "WITHDRAWAL",
      metadata: {
        status: withdrawal.status,
        payoutUsdCents: withdrawal.payoutUsdCents,
        network: withdrawal.network,
        txHash: withdrawal.txHash,
      },
    })
  ).catch((error) => console.error("Withdrawal notification error:", error));

/**
 * Admin: the payout has been sent. Requires the transaction hash so there is a
 * verifiable record of every payment.
 */
export const markWithdrawalPaid = async ({ withdrawalId, txHash, processedBy }, db = prisma) => {
  const hash = typeof txHash === "string" ? txHash.trim() : "";
  if (!hash) {
    throw new WithdrawalError(400, "TX_HASH_REQUIRED", "Add the payout transaction hash before marking it paid");
  }

  const updated = await db.coinWithdrawal.updateMany({
    where: { id: withdrawalId, status: "pending" },
    data: { status: "paid", txHash: hash, processedAt: new Date(), processedBy: processedBy || null },
  });
  if (updated.count === 0) {
    throw new WithdrawalError(409, "NOT_PENDING", "This withdrawal is no longer pending");
  }

  const withdrawal = await db.coinWithdrawal.findUnique({
    where: { id: withdrawalId },
    select: { ...withdrawalSelect, userId: true },
  });
  notifyWithdrawal(withdrawal, withdrawal.userId);
  return withdrawal;
};

/** Admin: refuse the request and give the held coins back. */
export const rejectWithdrawal = async ({ withdrawalId, adminNote, processedBy }, db = prisma) => {
  const note = typeof adminNote === "string" ? adminNote.trim().slice(0, 500) || null : null;

  const withdrawal = await db.$transaction(
    async (tx) => {
      // Guarded on status so a double click, or paid-then-reject, cannot refund twice.
      const updated = await tx.coinWithdrawal.updateMany({
        where: { id: withdrawalId, status: "pending" },
        data: { status: "rejected", adminNote: note, processedAt: new Date(), processedBy: processedBy || null },
      });
      if (updated.count === 0) {
        throw new WithdrawalError(409, "NOT_PENDING", "This withdrawal is no longer pending");
      }

      const row = await tx.coinWithdrawal.findUnique({
        where: { id: withdrawalId },
        select: { ...withdrawalSelect, userId: true },
      });

      const user = await tx.user.update({
        where: { id: row.userId },
        data: {
          coinBalance: { increment: row.coins },
          earnedCoinBalance: { increment: row.coins },
        },
        select: { coinBalance: true },
      });

      await tx.coinTransaction.create({
        data: {
          id: uuidV4(),
          userId: row.userId,
          type: "withdrawal_refund",
          amount: row.coins,
          balanceAfter: user.coinBalance,
          description: "Withdrawal rejected: coins returned",
          metadata: { withdrawalId: row.id, adminNote: note },
        },
      });

      return row;
    },
    { maxWait: 10000, timeout: 20000 }
  );

  notifyWithdrawal(withdrawal, withdrawal.userId);
  return withdrawal;
};
