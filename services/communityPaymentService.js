import { prisma } from "../config/db.js";
import { createCheckout, isWhopConfigured } from './whopService.js';
import {
  claimTransactionForFulfilment,
  confirmWhopTransaction
} from './whopPaymentConfirmation.js';

/**
 * Paid community membership, charged through Whop.
 *
 * Whop is the only gateway for this flow. The Paystack and Stripe branches
 * that lived here were removed rather than left dormant: they required a
 * per-community Paystack subaccount or Stripe account id that the app never
 * collected, and the request validator only accepted Mongo-style ids while
 * communities use UUIDs, so no payment could ever have reached them.
 *
 * Communities saved with `paymentMethods: ['paystack']` (or anything else)
 * are still payable — the stored list is ignored and Whop is used.
 *
 * Flow: initializePayment creates a pending Transaction and a Whop checkout
 * whose metadata carries the transaction id → the app opens the checkout →
 * Whop's `payment.succeeded` webhook (or the app's verify call, once the
 * webhook has recorded the payment id) → handleCommunityPaymentSuccess.
 */

const TRANSACTION_TYPE = 'community_membership';

/** Statuses that already give access; `muted` members are still members. */
const MEMBER_STATUSES = ['active', 'muted'];

const periodEndFrom = (start, subscriptionType) => {
  const end = new Date(start);
  switch (subscriptionType) {
    case 'monthly':
      end.setMonth(end.getMonth() + 1);
      return end;
    case 'yearly':
      end.setFullYear(end.getFullYear() + 1);
      return end;
    // one_time is lifetime access.
    default:
      return null;
  }
};

/**
 * The period bought by the member's most recent completed payment.
 *
 * CommunityMember has no subscription columns, so the period lives on the
 * Transaction that paid for it (metadata.subscription). That avoids a
 * migration and keeps the record of what was bought next to the money.
 */
const latestPaidPeriod = async (client, { userId, communityId, excludeId }) => {
  const last = await client.transaction.findFirst({
    where: {
      userId,
      communityId,
      status: 'completed',
      ...(excludeId ? { id: { not: excludeId } } : {})
    },
    orderBy: { createdAt: 'desc' },
    select: { metadata: true }
  });
  if (!last) return null;

  const endDate = last.metadata?.subscription?.endDate;
  return { endDate: endDate ? new Date(endDate) : null };
};

/**
 * Initialize payment for community membership
 * @param {Object} options - Payment options
 * @param {String} options.userId - User ID
 * @param {String} options.communityId - Community ID
 * @param {String} [options.paymentMethod] - Ignored. Older app builds still
 *   send `paystack`/`stripe`; every payment goes through Whop.
 * @returns {Promise<Object>} - `{ success, authorizationUrl, reference }`
 */
export const initializePayment = async ({ userId, communityId }) => {
  try {
    if (!isWhopConfigured()) {
      throw new Error('Payments are temporarily unavailable. Please try again later.');
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) {
      throw new Error('User not found');
    }

    const community = await prisma.community.findUnique({ where: { id: communityId } });
    if (!community) {
      throw new Error('Community not found');
    }

    const paymentSettings = community.settings?.payment || {};
    if (!paymentSettings.isPaidCommunity) {
      throw new Error('This community is not a paid community');
    }

    if (community.ownerId === userId) {
      throw new Error('You own this community');
    }

    const amount = Number(paymentSettings.price);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('This community has no valid membership price configured');
    }

    const membership = await prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId, userId } }
    });

    // Checked before charging: payment does not lift a ban, so taking the
    // money would only create a refund.
    if (membership?.status === 'banned') {
      throw new Error('You are banned from this community');
    }

    if (membership && MEMBER_STATUSES.includes(membership.status)) {
      const period = await latestPaidPeriod(prisma, { userId, communityId });
      // Joined free before the community started charging, bought lifetime
      // access, or a paid period is still running: nothing to buy. Only an
      // expired monthly/yearly period can be renewed.
      if (!period || !period.endDate || period.endDate > new Date()) {
        throw new Error('You are already a member of this community');
      }
    }

    const currency = paymentSettings.currency || 'USD';
    const subscriptionType = paymentSettings.subscriptionType || 'one_time';
    const reference = `COMM-${Date.now()}-${userId.substring(0, 6)}`;

    const transaction = await prisma.transaction.create({
      data: {
        userId,
        communityId,
        amount,
        currency,
        paymentMethod: 'whop',
        paymentReference: reference,
        status: 'pending',
        metadata: { type: TRANSACTION_TYPE, subscriptionType }
      }
    });

    // Whop echoes this back on the webhook. Values are kept as strings: that
    // is the shape already proven by the subscription checkout.
    const metadata = {
      type: TRANSACTION_TYPE,
      transactionId: transaction.id,
      reference,
      userId,
      communityId
    };

    try {
      const { purchaseUrl, sessionId, planId: whopPlanId, raw } = await createCheckout({
        amount,
        currency,
        title: `Aeko — ${community.name} membership`,
        metadata,
        returnUrl: process.env.FRONTEND_URL
          ? `${process.env.FRONTEND_URL}/payment/callback`
          : undefined
      });

      // The provider response is always persisted, so a renamed URL field
      // shows up as a stored payload rather than a bare failure.
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          providerResponse: raw ?? undefined,
          metadata: {
            ...metadata,
            subscriptionType,
            whopSessionId: sessionId ?? undefined,
            whopPlanId: whopPlanId ?? undefined
          }
        }
      });

      if (!purchaseUrl) {
        throw new Error('Whop did not return a checkout URL');
      }

      return {
        success: true,
        authorizationUrl: purchaseUrl,
        reference
      };
    } catch (error) {
      console.error('Whop community checkout error:', error.response || error.message);
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: 'failed', failureReason: error.message }
      });
      throw new Error('Failed to start checkout. Please try again.');
    }
  } catch (error) {
    console.error('Payment initialization error:', error.message);
    throw error;
  }
};

/**
 * Grants membership for a paid community transaction.
 *
 * Called by both the Whop webhook and verifyPayment, often concurrently, and
 * Whop replays webhooks. claimTransactionForFulfilment makes this run at most
 * once per transaction: a second caller sees `alreadyProcessed` and changes
 * nothing, so members are never double-counted and earnings never
 * double-credited.
 */
export const handleCommunityPaymentSuccess = async (transactionId) => {
  const existing = await prisma.transaction.findUnique({
    where: { id: transactionId },
    select: { id: true, communityId: true }
  });

  if (!existing) {
    throw new Error('Transaction not found');
  }
  if (!existing.communityId) {
    throw new Error('Transaction is not a community membership payment');
  }

  return prisma.$transaction(async (tx) => {
    const claimed = await claimTransactionForFulfilment(tx, transactionId);
    if (!claimed) {
      return { success: true, alreadyProcessed: true, message: 'Transaction already processed' };
    }

    const transaction = await tx.transaction.findUnique({ where: { id: transactionId } });
    const { userId, communityId } = transaction;

    const community = await tx.community.findUnique({
      where: { id: communityId },
      // The relation is `chats` (Chat?), not `chat`.
      include: { chats: true }
    });
    if (!community) {
      // Throwing rolls the claim back, so a retry can still fulfil this.
      throw new Error('Community not found');
    }

    const settings = community.settings || {};
    const payment = settings.payment || {};
    const subscriptionType =
      transaction.metadata?.subscriptionType || payment.subscriptionType || 'one_time';

    // A second payment while a period is still running (two checkouts opened
    // at once, say) extends from the current end rather than overlapping it.
    const now = new Date();
    const previous = await latestPaidPeriod(tx, { userId, communityId, excludeId: transactionId });
    const start = previous?.endDate && previous.endDate > now ? previous.endDate : now;
    const endDate = periodEndFrom(start, subscriptionType);

    const membership = await tx.communityMember.findUnique({
      where: { communityId_userId: { communityId, userId } }
    });

    let joined = false;
    let banned = false;

    if (!membership) {
      await tx.communityMember.create({
        data: { communityId, userId, role: 'member', status: 'active' }
      });
      joined = true;
    } else if (membership.status === 'banned') {
      // Banned between checkout and payment. Payment does not lift a ban; the
      // row is flagged so the payment can be refunded.
      banned = true;
    } else if (!MEMBER_STATUSES.includes(membership.status)) {
      // A pending join request: paying is what lets them in.
      await tx.communityMember.update({
        where: { id: membership.id },
        data: { status: 'active' }
      });
      joined = true;
    }

    if (joined) {
      await tx.community.update({
        where: { id: communityId },
        data: { memberCount: { increment: 1 } }
      });

      if (community.chats) {
        await tx.chatMember.createMany({
          data: [{ chatId: community.chats.id, userId }],
          skipDuplicates: true
        });
      }
    }

    await tx.transaction.update({
      where: { id: transactionId },
      data: {
        metadata: {
          ...(transaction.metadata || {}),
          subscription: {
            type: subscriptionType,
            startDate: start.toISOString(),
            endDate: endDate ? endDate.toISOString() : null
          },
          ...(banned ? { requiresRefund: true, refundReason: 'member_banned' } : {})
        }
      }
    });

    if (!banned) {
      // Re-read inside the transaction: the member-count update above does not
      // touch settings, but a stale copy from before the claim could.
      const fresh = await tx.community.findUnique({
        where: { id: communityId },
        select: { settings: true }
      });
      const nextSettings = fresh?.settings || {};
      const nextPayment = nextSettings.payment || {};

      nextPayment.availableForWithdrawal = (nextPayment.availableForWithdrawal || 0) + transaction.amount;
      nextPayment.totalEarnings = (nextPayment.totalEarnings || 0) + transaction.amount;
      nextSettings.payment = nextPayment;

      await tx.community.update({
        where: { id: communityId },
        data: { settings: nextSettings }
      });
    }

    return { success: true, joined, banned };
  }, { timeout: 15000 });
};

/**
 * Confirms a community payment and grants access if it has cleared.
 * @param {Object} options
 * @param {String} options.reference - Payment reference from initialization
 * @returns {Promise<{success: boolean, pending?: boolean, message: string}>}
 *   `pending` is a normal answer: the webhook can land after the browser
 *   closes.
 */
export const verifyPayment = async ({ reference }) => {
  try {
    const transaction = await prisma.transaction.findFirst({ where: { paymentReference: reference } });
    if (!transaction || !transaction.communityId) {
      throw new Error('Transaction not found');
    }

    if (transaction.status === 'completed') {
      return {
        success: true,
        pending: false,
        message: 'Payment already verified',
        alreadyProcessed: true,
        transactionId: transaction.id,
        verifiedAt: transaction.verifiedAt ?? transaction.updatedAt
      };
    }

    // Every community payment is confirmed through Whop, whatever
    // paymentMethod the caller sends.
    const verificationResult = await confirmWhopTransaction(transaction);

    if (verificationResult.success) {
      await handleCommunityPaymentSuccess(transaction.id);
    }

    return verificationResult;
  } catch (error) {
    console.error('Payment verification error:', error.message);
    throw error;
  }
};

/**
 * Request withdrawal of community earnings
 * @param {Object} options - Withdrawal options
 * @param {String} options.communityId - Community ID
 * @param {String} options.adminId - Admin/owner ID
 * @param {Number} options.amount - Amount to withdraw
 * @param {String} options.method - Withdrawal method (bank, aeko_wallet)
 * @param {Object} options.details - Withdrawal details (bank info, etc.)
 * @returns {Promise<Object>} - Withdrawal request result
 */
export const requestWithdrawal = async ({ communityId, adminId, amount, method, details }) => {
  return await prisma.$transaction(async (tx) => {
    try {
      const community = await tx.community.findUnique({ where: { id: communityId } });

      if (!community) {
        throw new Error('Community not found');
      }

      if (community.ownerId !== adminId) {
        throw new Error('Only community owner can request withdrawal');
      }

      const settings = community.settings || {};
      const payment = settings.payment || {};

      // Calculate available balance as totalEarnings - pendingWithdrawals
      const totalEarnings = payment.totalEarnings || 0;
      const pendingWithdrawals = payment.pendingWithdrawals || 0;
      const availableBalance = totalEarnings - pendingWithdrawals;

      // Validate withdrawal amount against available balance
      if (amount > availableBalance) {
        throw new Error(
          `Insufficient balance for withdrawal. Available: ${availableBalance}, Requested: ${amount}, Pending: ${pendingWithdrawals}`
        );
      }

      if (amount <= 0) {
        throw new Error('Withdrawal amount must be greater than zero');
      }

      // Create withdrawal record
      const withdrawal = {
        amount,
        status: 'pending',
        method,
        reference: `WDR-${Date.now()}-${communityId.substring(0, 6)}`,
        metadata: details,
        processedAt: new Date()
      };

      // Increment pendingWithdrawals when withdrawal is initiated
      payment.pendingWithdrawals = pendingWithdrawals + amount;

      // Process withdrawal based on method
      let result;
      try {
        // For bank transfers, mark as pending and process in background
        result = { success: true, message: 'Withdrawal request received' };
        // pendingWithdrawals remains incremented until background processing completes
      } catch (withdrawalError) {
        // Decrement pendingWithdrawals when withdrawal fails
        payment.pendingWithdrawals -= amount;
        withdrawal.status = 'failed';
        withdrawal.metadata = {
          ...withdrawal.metadata,
          error: withdrawalError.message
        };
        console.error('Withdrawal processing error:', withdrawalError);
        throw withdrawalError;
      }

      // Add to withdrawal history
      const withdrawalHistory = payment.withdrawalHistory || [];
      withdrawalHistory.push(withdrawal);
      payment.withdrawalHistory = withdrawalHistory;
      settings.payment = payment;

      await tx.community.update({
        where: { id: communityId },
        data: { settings }
      });

      return {
        success: true,
        message: 'Withdrawal request processed',
        withdrawal,
        availableBalance: totalEarnings - payment.pendingWithdrawals
      };
    } catch (error) {
      console.error('Withdrawal error:', error);
      throw error;
    }
  });
};

/**
 * Complete a pending withdrawal (for background processing)
 * @param {Object} options - Completion options
 * @param {String} options.communityId - Community ID
 * @param {String} options.reference - Withdrawal reference
 * @param {Boolean} options.success - Whether withdrawal succeeded
 * @param {String} options.errorMessage - Error message if failed
 * @returns {Promise<Object>} - Completion result
 */
export const completeWithdrawal = async ({ communityId, reference, success, errorMessage }) => {
  return await prisma.$transaction(async (tx) => {
    try {
      const community = await tx.community.findUnique({ where: { id: communityId } });

      if (!community) {
        throw new Error('Community not found');
      }

      const settings = community.settings || {};
      const payment = settings.payment || {};
      const withdrawalHistory = payment.withdrawalHistory || [];

      // Find the withdrawal in history
      const withdrawalIndex = withdrawalHistory.findIndex(
        w => w.reference === reference
      );

      if (withdrawalIndex === -1) {
        throw new Error('Withdrawal not found');
      }

      const withdrawal = withdrawalHistory[withdrawalIndex];

      if (withdrawal.status !== 'pending') {
        throw new Error(`Withdrawal already ${withdrawal.status}`);
      }

      const amount = withdrawal.amount;

      if (success) {
        // Mark withdrawal as completed
        withdrawal.status = 'completed';
        withdrawal.processedAt = new Date();

        // Decrement pendingWithdrawals when withdrawal completes
        payment.pendingWithdrawals =
          Math.max(0, (payment.pendingWithdrawals || 0) - amount);

        // Update availableForWithdrawal to reflect the completed withdrawal
        payment.availableForWithdrawal =
          Math.max(0, (payment.availableForWithdrawal || 0) - amount);
      } else {
        // Mark withdrawal as failed
        withdrawal.status = 'failed';
        withdrawal.metadata = {
          ...withdrawal.metadata,
          error: errorMessage
        };

        // Decrement pendingWithdrawals when withdrawal fails (restore available balance)
        payment.pendingWithdrawals =
          Math.max(0, (payment.pendingWithdrawals || 0) - amount);
      }

      // Update the withdrawal in the array
      withdrawalHistory[withdrawalIndex] = withdrawal;
      payment.withdrawalHistory = withdrawalHistory;
      settings.payment = payment;

      await tx.community.update({
        where: { id: communityId },
        data: { settings }
      });

      return {
        success: true,
        message: `Withdrawal ${success ? 'completed' : 'failed'}`,
        withdrawal
      };
    } catch (error) {
      console.error('Withdrawal completion error:', error);
      throw error;
    }
  });
};
