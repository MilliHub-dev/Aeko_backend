import axios from 'axios';
import dotenv from 'dotenv';
import { prisma } from "../config/db.js";

dotenv.config();

// Initialize payment providers
const paystack = axios.create({
  baseURL: 'https://api.paystack.co',
  headers: {
    'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
    'Content-Type': 'application/json'
  }
});

import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Retry helper function with exponential backoff
 * @param {Function} apiCall - The API call function to retry
 * @param {Number} maxRetries - Maximum number of retries (default: 1)
 * @returns {Promise<any>} - Result of the API call
 */
async function callWithRetry(apiCall, maxRetries = 1) {
  let lastError;
  let retryCount = 0;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await apiCall();
      return { result, retryCount };
    } catch (error) {
      lastError = error;
      retryCount = attempt;
      
      // Don't retry on client errors (4xx)
      const statusCode = error.response?.status || error.statusCode;
      if (statusCode >= 400 && statusCode < 500) {
        console.log(`[Retry Logic] Client error (${statusCode}), not retrying`);
        throw error;
      }
      
      // Don't retry if this was the last attempt
      if (attempt >= maxRetries) {
        console.log(`[Retry Logic] Max retries (${maxRetries}) reached, failing`);
        break;
      }
      
      // Wait before retry with exponential backoff
      const backoffMs = Math.pow(2, attempt) * 1000;
      console.log(`[Retry Logic] Attempt ${attempt + 1} failed, retrying in ${backoffMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, backoffMs));
    }
  }
  
  // All retries exhausted
  throw lastError;
}

/**
 * Initialize payment for community membership
 * @param {Object} options - Payment options
 * @param {String} options.userId - User ID
 * @param {String} options.communityId - Community ID
 * @param {String} options.paymentMethod - Payment method (paystack, stripe)
 * @returns {Promise<Object>} - Payment initialization response
 */
export const initializePayment = async ({ userId, communityId, paymentMethod }) => {
  try {
    // Fetch user from database and validate existence
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    // Extract and validate user email
    if (!user.email) {
      throw new Error('User email is required for payment processing');
    }

    const community = await prisma.community.findUnique({ where: { id: communityId } });
    if (!community) {
      throw new Error('Community not found');
    }

    const paymentSettings = community.settings?.payment || {};
    if (!paymentSettings.isPaidCommunity) {
      throw new Error('This community is not a paid community');
    }

    // Validate payment method is supported by the community
    const availablePaymentMethods = paymentSettings.paymentMethods || [];
    
    if (!availablePaymentMethods.includes(paymentMethod)) {
      throw new Error(
        `Payment method '${paymentMethod}' is not available for this community. ` +
        `Available methods: ${availablePaymentMethods.join(', ') || 'none configured'}`
      );
    }

    // Validate payment method configuration
    if (paymentMethod === 'stripe') {
      if (!paymentSettings.stripeAccountId) {
        throw new Error(
          'Stripe payment method is not properly configured for this community. ' +
          'Missing Stripe account ID.'
        );
      }
    }

    if (paymentMethod === 'paystack') {
      if (!paymentSettings.paystackSubaccount) {
        throw new Error(
          'Paystack payment method is not properly configured for this community. ' +
          'Missing Paystack subaccount.'
        );
      }
    }

    // Check if user already has active subscription
    const members = community.members || [];
    const existingMember = members.find(
      m => m.user === userId && m.status === 'active'
    );

    if (existingMember && existingMember.subscription?.isActive) {
      // Check if subscription is not expired
      if (!existingMember.subscription.endDate || 
          new Date() < new Date(existingMember.subscription.endDate)) {
        throw new Error('You already have an active subscription to this community');
      }
    }

    const amount = paymentSettings.price;
    const currency = paymentSettings.currency || 'USD';
    const reference = `COMM-${Date.now()}-${userId.substring(0, 6)}`;

    // Create transaction record
    const transaction = await prisma.transaction.create({
      data: {
        userId,
        communityId,
        amount,
        currency,
        paymentMethod,
        paymentReference: reference,
        status: 'pending'
      }
    });

    // Handle different payment methods
    switch (paymentMethod) {
      case 'paystack':
        return await initializePaystackPayment({
          email: user.email,
          amount: amount * 100, // Paystack uses kobo
          reference,
          metadata: {
            userId,
            communityId,
            transactionId: transaction.id
          }
        });

      case 'stripe':
        return await initializeStripePayment({
          amount,
          currency,
          description: `Membership for ${community.name}`,
          metadata: {
            userId,
            communityId,
            transactionId: transaction.id
          }
        });

      default:
        throw new Error('Unsupported payment method');
    }
  } catch (error) {
    console.error('Payment initialization error:', error);
    throw error;
  }
};

/**
 * Handle successful community payment (Used by Webhooks and Verification)
 */
export const handleCommunityPaymentSuccess = async (transactionId) => {
  const transaction = await prisma.transaction.findUnique({ where: { id: transactionId } });

  if (!transaction) {
    throw new Error('Transaction not found');
  }

  if (transaction.status === 'completed') {
    return { success: true, message: 'Transaction already processed' };
  }

  await prisma.$transaction(async (tx) => {
    await updateCommunityMembershipWithTx({
      userId: transaction.userId,
      communityId: transaction.communityId,
      transactionId: transaction.id,
      paymentMethod: transaction.paymentMethod,
      tx
    });

    await tx.transaction.update({
      where: { id: transaction.id },
      data: { status: 'completed', verifiedAt: new Date() }
    });

    // Update community earnings
    const community = await tx.community.findUnique({ where: { id: transaction.communityId } });
    const settings = community.settings || {};
    const payment = settings.payment || {};

    payment.availableForWithdrawal = (payment.availableForWithdrawal || 0) + transaction.amount;
    payment.totalEarnings = (payment.totalEarnings || 0) + transaction.amount;
    
    settings.payment = payment;

    await tx.community.update({
      where: { id: transaction.communityId },
      data: { settings }
    });
  });

  return { success: true };
};

/**
 * Verify payment and grant community access
 * @param {Object} options - Payment verification options
 * @param {String} options.reference - Payment reference
 * @param {String} options.paymentMethod - Payment method
 * @returns {Promise<Object>} - Payment verification result
 */
export const verifyPayment = async ({ reference, paymentMethod }) => {
  try {
    const transaction = await prisma.transaction.findFirst({ where: { paymentReference: reference } });
    if (!transaction) {
      throw new Error('Transaction not found');
    }

    // Idempotency check: Return cached success response if already completed
    if (transaction.status === 'completed') {
      console.log(`[Payment Verification] Duplicate verification attempt detected for reference: ${reference}. Transaction already completed at ${transaction.updatedAt}`);
      
      return { 
        success: true, 
        message: 'Payment already verified',
        alreadyProcessed: true,
        transactionId: transaction.id,
        verifiedAt: transaction.updatedAt
      };
    }

    let verificationResult;
    
    switch (paymentMethod) {
      case 'paystack':
        verificationResult = await verifyPaystackPayment(reference);
        break;

      case 'stripe':
        verificationResult = await verifyStripePayment(reference);
        break;

      default:
        throw new Error('Unsupported payment method');
    }

    if (verificationResult.success) {
      await handleCommunityPaymentSuccess(transaction.id);
    }

    return verificationResult;
  } catch (error) {
    console.error('Payment verification error:', error);
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

// Helper functions for payment providers
async function initializePaystackPayment({ email, amount, reference, metadata }) {
  try {
    const { result, retryCount } = await callWithRetry(async () => {
      return await paystack.post('/transaction/initialize', {
        email,
        amount,
        reference,
        metadata,
        callback_url: `${process.env.FRONTEND_URL}/payment/callback`
      });
    }, 1); // Max 1 retry

    // Update transaction with retry count if retries occurred
    if (retryCount > 0 && metadata.transactionId) {
      await prisma.transaction.update({
        where: { id: metadata.transactionId },
        data: {
          retryCount,
          metadata: {
             ...metadata,
             retryCount
          }
        }
      });
    }

    return {
      success: true,
      authorizationUrl: result.data.data.authorization_url,
      accessCode: result.data.data.access_code,
      reference: result.data.data.reference
    };
  } catch (error) {
    console.error('Paystack initialization error:', error.response?.data || error.message);
    
    // Update transaction with failure reason
    if (metadata.transactionId) {
      const failureReason = error.response?.data?.message || error.message || 'Failed to initialize Paystack payment';
      await prisma.transaction.update({
        where: { id: metadata.transactionId },
        data: {
          status: 'failed',
          failureReason,
          metadata: {
             ...metadata,
             failureReason
          }
        }
      });
    }
    
    throw new Error('Failed to initialize Paystack payment');
  }
}

async function initializeStripePayment({ amount, currency, description, metadata }) {
  try {
    const { result: paymentIntent, retryCount } = await callWithRetry(async () => {
      return await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: currency.toLowerCase(),
        description,
        metadata,
        automatic_payment_methods: {
          enabled: true,
        },
      });
    }, 1); // Max 1 retry

    // Update transaction with retry count if retries occurred
    if (retryCount > 0 && metadata.transactionId) {
      await prisma.transaction.update({
        where: { id: metadata.transactionId },
        data: {
          retryCount,
          metadata: {
             ...metadata,
             retryCount
          }
        }
      });
    }

    return {
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    };
  } catch (error) {
    console.error('Stripe initialization error:', error);
    
    // Update transaction with failure reason
    if (metadata.transactionId) {
      const failureReason = error.message || 'Failed to initialize Stripe payment';
      await prisma.transaction.update({
        where: { id: metadata.transactionId },
        data: {
          status: 'failed',
          failureReason,
          metadata: {
             ...metadata,
             failureReason
          }
        }
      });
    }
    
    throw new Error('Failed to initialize Stripe payment');
  }
}

async function verifyPaystackPayment(reference) {
  try {
    const { result: response, retryCount } = await callWithRetry(async () => {
      return await paystack.get(`/transaction/verify/${reference}`);
    }, 1); // Max 1 retry

    // Update transaction with retry count if retries occurred
    if (retryCount > 0) {
      const transaction = await prisma.transaction.findFirst({ where: { paymentReference: reference } });
      if (transaction) {
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: {
            retryCount,
            metadata: {
              ...(transaction.metadata || {}),
              verificationRetryCount: retryCount
            }
          }
        });
      }
    }
    
    if (response.data.data.status === 'success') {
      return { success: true, message: 'Payment verified successfully' };
    } else {
      return { success: false, message: 'Payment verification failed' };
    }
  } catch (error) {
    console.error('Paystack verification error:', error.response?.data || error.message);
    
    // Update transaction with failure reason
    const failureReason = error.response?.data?.message || error.message || 'Failed to verify Paystack payment';
    const transaction = await prisma.transaction.findFirst({ where: { paymentReference: reference } });
    
    if (transaction) {
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: 'failed',
          failureReason,
          metadata: {
            ...(transaction.metadata || {}),
            verificationFailureReason: failureReason
          }
        }
      });
    }
    
    throw new Error('Failed to verify Paystack payment');
  }
}

async function verifyStripePayment(paymentIntentId) {
  try {
    const { result: paymentIntent, retryCount } = await callWithRetry(async () => {
      return await stripe.paymentIntents.retrieve(paymentIntentId);
    }, 1); // Max 1 retry

    // Update transaction with retry count if retries occurred
    if (retryCount > 0) {
      const transaction = await prisma.transaction.findFirst({ where: { paymentReference: paymentIntentId } });
      if (transaction) {
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: {
            retryCount,
            metadata: {
              ...(transaction.metadata || {}),
              verificationRetryCount: retryCount
            }
          }
        });
      }
    }
    
    if (paymentIntent.status === 'succeeded') {
      return { success: true, message: 'Payment verified successfully' };
    } else {
      return { success: false, message: `Payment status: ${paymentIntent.status}` };
    }
  } catch (error) {
    console.error('Stripe verification error:', error);
    
    // Update transaction with failure reason
    const failureReason = error.message || 'Failed to verify Stripe payment';
    const transaction = await prisma.transaction.findFirst({ where: { paymentReference: paymentIntentId } });
    
    if (transaction) {
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: 'failed',
          failureReason,
          metadata: {
            ...(transaction.metadata || {}),
            verificationFailureReason: failureReason
          }
        }
      });
    }
    
    throw new Error('Failed to verify Stripe payment');
  }
}

/**
 * Update community membership with transaction support
 * @param {Object} options - Membership update options
 * @param {String} options.userId - User ID
 * @param {String} options.communityId - Community ID
 * @param {String} options.transactionId - Transaction ID
 * @param {String} options.paymentMethod - Payment method used
 * @param {Object} options.tx - Prisma transaction client
 */
async function updateCommunityMembershipWithTx({ userId, communityId, transactionId, paymentMethod, tx }) {
  const community = await tx.community.findUnique({ where: { id: communityId } });
  const user = await tx.user.findUnique({ where: { id: userId } });
  const now = new Date();
  
  // Calculate subscription end date based on subscription type
  const settings = community.settings || {};
  const payment = settings.payment || {};
  const subscriptionType = payment.subscriptionType || 'one_time';
  let endDate = new Date();
  
  switch (subscriptionType) {
    case 'monthly':
      endDate.setMonth(now.getMonth() + 1);
      break;
    case 'yearly':
      endDate.setFullYear(now.getFullYear() + 1);
      break;
    // For one_time, no end date (lifetime access)
    default:
      endDate = null;
  }

  const subscriptionData = {
    type: subscriptionType,
    startDate: now,
    endDate,
    isActive: true,
    paymentMethod,
    transactionId
  };

  // Add or update membership in Community model
  const members = community.members || [];
  const memberIndex = members.findIndex(m => m.user === userId);
  let memberCount = community.memberCount;
  
  if (memberIndex >= 0) {
    // Update existing membership
    members[memberIndex].subscription = subscriptionData;
    members[memberIndex].status = 'active';
  } else {
    // Add new member
    members.push({
      user: userId,
      role: 'member',
      status: 'active',
      subscription: subscriptionData
    });
    memberCount += 1;
  }

  await tx.community.update({
    where: { id: communityId },
    data: { members, memberCount }
  });

  // Synchronize with User.communities array
  const communities = user.communities || [];
  const communityIndex = communities.findIndex(
    c => c.community === communityId
  );
  
  if (communityIndex >= 0) {
    // Update existing community entry
    communities[communityIndex].role = 'member';
    communities[communityIndex].subscription = subscriptionData;
  } else {
    // Add new community entry
    communities.push({
      community: communityId,
      role: 'member',
      joinedAt: now,
      notifications: true,
      subscription: subscriptionData
    });
  }
  
  await tx.user.update({
    where: { id: userId },
    data: { communities }
  });
}

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
