import axios from 'axios';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Community from '../models/Community.js';
import Transaction from '../models/Transaction.js';

dotenv.config();

// Initialize payment providers
const paystack = axios.create({
  baseURL: 'https://api.paystack.co',
  headers: {
    'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
    'Content-Type': 'application/json'
  }
});

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

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
 * @param {String} options.paymentMethod - Payment method (paystack, stripe, aeko_wallet)
 * @returns {Promise<Object>} - Payment initialization response
 */
export const initializePayment = async ({ userId, communityId, paymentMethod }) => {
  try {
    // Fetch user from database and validate existence
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Extract and validate user email
    if (!user.email) {
      throw new Error('User email is required for payment processing');
    }

    const community = await Community.findById(communityId);
    if (!community) {
      throw new Error('Community not found');
    }

    if (!community.settings.payment.isPaidCommunity) {
      throw new Error('This community is not a paid community');
    }

    // Validate payment method is supported by the community
    const availablePaymentMethods = community.settings.payment.paymentMethods || [];
    
    if (!availablePaymentMethods.includes(paymentMethod)) {
      throw new Error(
        `Payment method '${paymentMethod}' is not available for this community. ` +
        `Available methods: ${availablePaymentMethods.join(', ') || 'none configured'}`
      );
    }

    // Validate payment method configuration
    if (paymentMethod === 'stripe') {
      if (!community.settings.payment.stripeAccountId) {
        throw new Error(
          'Stripe payment method is not properly configured for this community. ' +
          'Missing Stripe account ID.'
        );
      }
    }

    if (paymentMethod === 'paystack') {
      if (!community.settings.payment.paystackSubaccount) {
        throw new Error(
          'Paystack payment method is not properly configured for this community. ' +
          'Missing Paystack subaccount.'
        );
      }
    }

    // Check if user already has active subscription
    const existingMember = community.members.find(
      m => m.user.toString() === userId && m.status === 'active'
    );

    if (existingMember && existingMember.subscription?.isActive) {
      // Check if subscription is not expired
      if (!existingMember.subscription.endDate || 
          new Date() < new Date(existingMember.subscription.endDate)) {
        throw new Error('You already have an active subscription to this community');
      }
    }

    const amount = community.settings.payment.price;
    const currency = community.settings.payment.currency || 'USD';
    const reference = `COMM-${Date.now()}-${userId.substring(0, 6)}`;

    // Create transaction record
    const transaction = new Transaction({
      user: userId,
      community: communityId,
      amount,
      currency,
      paymentMethod,
      paymentReference: reference,
      status: 'pending'
    });

    await transaction.save();

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
            transactionId: transaction._id
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
            transactionId: transaction._id.toString()
          }
        });

      case 'aeko_wallet':
        return await processAekoWalletPayment({
          userId,
          communityId,
          amount,
          transactionId: transaction._id
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
 * Verify payment and grant community access
 * @param {Object} options - Payment verification options
 * @param {String} options.reference - Payment reference
 * @param {String} options.paymentMethod - Payment method
 * @returns {Promise<Object>} - Payment verification result
 */
export const verifyPayment = async ({ reference, paymentMethod }) => {
  try {
    const transaction = await Transaction.findOne({ paymentReference: reference });
    if (!transaction) {
      throw new Error('Transaction not found');
    }

    // Idempotency check: Return cached success response if already completed
    if (transaction.status === 'completed') {
      console.log(`[Payment Verification] Duplicate verification attempt detected for reference: ${reference}. Transaction already completed at ${transaction.verifiedAt || transaction.updatedAt}`);
      
      return { 
        success: true, 
        message: 'Payment already verified',
        alreadyProcessed: true,
        transactionId: transaction._id,
        verifiedAt: transaction.verifiedAt || transaction.updatedAt
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

      case 'aeko_wallet':
        // Aeko wallet payments are processed immediately
        return { success: true, message: 'Payment processed successfully' };

      default:
        throw new Error('Unsupported payment method');
    }

    if (verificationResult.success) {
      await updateCommunityMembership({
        userId: transaction.user,
        communityId: transaction.community,
        transactionId: transaction._id,
        paymentMethod
      });

      transaction.status = 'completed';
      await transaction.save();

      // Update community earnings
      await Community.findByIdAndUpdate(transaction.community, {
        $inc: {
          'settings.payment.availableForWithdrawal': transaction.amount,
          'settings.payment.totalEarnings': transaction.amount
        }
      });
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
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const community = await Community.findById(communityId).session(session);
    
    if (!community) {
      throw new Error('Community not found');
    }

    if (community.owner.toString() !== adminId) {
      throw new Error('Only community owner can request withdrawal');
    }

    // Calculate available balance as totalEarnings - pendingWithdrawals
    const totalEarnings = community.settings.payment.totalEarnings || 0;
    const pendingWithdrawals = community.settings.payment.pendingWithdrawals || 0;
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
    community.settings.payment.pendingWithdrawals = pendingWithdrawals + amount;

    // Process withdrawal based on method
    let result;
    try {
      if (method === 'aeko_wallet') {
        // Transfer to admin's Aeko wallet
        result = await transferToAekoWallet({
          communityId,
          amount,
          reference: withdrawal.reference,
          details
        });
        withdrawal.status = 'completed';
        
        // Decrement pendingWithdrawals when withdrawal completes successfully
        community.settings.payment.pendingWithdrawals -= amount;
        // Also update availableForWithdrawal to reflect the completed withdrawal
        community.settings.payment.availableForWithdrawal = 
          (community.settings.payment.availableForWithdrawal || totalEarnings) - amount;
      } else {
        // For bank transfers, mark as pending and process in background
        result = { success: true, message: 'Withdrawal request received' };
        // pendingWithdrawals remains incremented until background processing completes
      }
    } catch (withdrawalError) {
      // Decrement pendingWithdrawals when withdrawal fails
      community.settings.payment.pendingWithdrawals -= amount;
      withdrawal.status = 'failed';
      withdrawal.metadata = {
        ...withdrawal.metadata,
        error: withdrawalError.message
      };
      console.error('Withdrawal processing error:', withdrawalError);
      throw withdrawalError;
    }

    // Add to withdrawal history atomically
    community.settings.payment.withdrawalHistory.push(withdrawal);
    await community.save({ session });

    await session.commitTransaction();

    return {
      success: true,
      message: 'Withdrawal request processed',
      withdrawal,
      availableBalance: totalEarnings - community.settings.payment.pendingWithdrawals
    };
  } catch (error) {
    await session.abortTransaction();
    console.error('Withdrawal error:', error);
    throw error;
  } finally {
    // Always end session to prevent memory leaks
    session.endSession();
  }
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
      await Transaction.findByIdAndUpdate(metadata.transactionId, {
        retryCount,
        $set: { 'metadata.retryCount': retryCount }
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
      await Transaction.findByIdAndUpdate(metadata.transactionId, {
        status: 'failed',
        failureReason,
        $set: { 'metadata.failureReason': failureReason }
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
      await Transaction.findByIdAndUpdate(metadata.transactionId, {
        retryCount,
        $set: { 'metadata.retryCount': retryCount }
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
      await Transaction.findByIdAndUpdate(metadata.transactionId, {
        status: 'failed',
        failureReason,
        $set: { 'metadata.failureReason': failureReason }
      });
    }
    
    throw new Error('Failed to initialize Stripe payment');
  }
}

async function processAekoWalletPayment({ userId, communityId, amount, transactionId }) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Fetch user and verify existence
    const user = await User.findById(userId).session(session);
    if (!user) {
      throw new Error('User not found');
    }

    // Check if user has sufficient Aeko balance
    const userBalance = user.aekoBalance || 0;
    if (userBalance < amount) {
      throw new Error(
        `Insufficient Aeko wallet balance. Available: ${userBalance}, Required: ${amount}`
      );
    }

    // Fetch transaction
    const transaction = await Transaction.findById(transactionId).session(session);
    if (!transaction) {
      throw new Error('Transaction not found');
    }

    // Fetch community
    const community = await Community.findById(communityId).session(session);
    if (!community) {
      throw new Error('Community not found');
    }

    // Atomically deduct from user's Aeko wallet
    user.aekoBalance -= amount;
    await user.save({ session });

    // Update transaction status
    transaction.status = 'completed';
    transaction.metadata = {
      ...transaction.metadata,
      walletBalanceBefore: userBalance,
      walletBalanceAfter: user.aekoBalance,
      processedAt: new Date()
    };
    await transaction.save({ session });

    // Update community membership
    await updateCommunityMembershipWithSession({
      userId,
      communityId,
      transactionId,
      paymentMethod: 'aeko_wallet',
      session
    });

    // Atomically update community earnings
    community.settings.payment.availableForWithdrawal = 
      (community.settings.payment.availableForWithdrawal || 0) + amount;
    community.settings.payment.totalEarnings = 
      (community.settings.payment.totalEarnings || 0) + amount;
    await community.save({ session });

    // Commit the transaction
    await session.commitTransaction();

    return { 
      success: true, 
      message: 'Payment processed successfully',
      newBalance: user.aekoBalance
    };
  } catch (error) {
    // Rollback on any error
    await session.abortTransaction();
    console.error('Aeko wallet payment error:', error);
    
    // Update transaction status to failed
    try {
      await Transaction.findByIdAndUpdate(transactionId, {
        status: 'failed',
        failureReason: error.message,
        $set: { 'metadata.failureReason': error.message }
      });
    } catch (updateError) {
      console.error('Failed to update transaction status:', updateError);
    }
    
    throw error;
  } finally {
    // Always end session to prevent memory leaks
    session.endSession();
  }
}

async function verifyPaystackPayment(reference) {
  try {
    const { result: response, retryCount } = await callWithRetry(async () => {
      return await paystack.get(`/transaction/verify/${reference}`);
    }, 1); // Max 1 retry

    // Update transaction with retry count if retries occurred
    if (retryCount > 0) {
      await Transaction.findOneAndUpdate(
        { paymentReference: reference },
        {
          retryCount,
          $set: { 'metadata.verificationRetryCount': retryCount }
        }
      );
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
    await Transaction.findOneAndUpdate(
      { paymentReference: reference },
      {
        status: 'failed',
        failureReason,
        $set: { 'metadata.verificationFailureReason': failureReason }
      }
    );
    
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
      await Transaction.findOneAndUpdate(
        { paymentReference: paymentIntentId },
        {
          retryCount,
          $set: { 'metadata.verificationRetryCount': retryCount }
        }
      );
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
    await Transaction.findOneAndUpdate(
      { paymentReference: paymentIntentId },
      {
        status: 'failed',
        failureReason,
        $set: { 'metadata.verificationFailureReason': failureReason }
      }
    );
    
    throw new Error('Failed to verify Stripe payment');
  }
}

async function updateCommunityMembership({ userId, communityId, transactionId, paymentMethod }) {
  const community = await Community.findById(communityId);
  const user = await User.findById(userId);
  const now = new Date();
  
  // Calculate subscription end date based on subscription type
  const subscriptionType = community.settings.payment.subscriptionType || 'one_time';
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
  const memberIndex = community.members.findIndex(m => m.user.toString() === userId);
  
  if (memberIndex >= 0) {
    // Update existing membership
    community.members[memberIndex].subscription = subscriptionData;
    community.members[memberIndex].status = 'active';
  } else {
    // Add new member
    community.members.push({
      user: userId,
      role: 'member',
      status: 'active',
      subscription: subscriptionData
    });
    community.memberCount += 1;
  }

  await community.save();

  // Synchronize with User.communities array
  const communityIndex = user.communities.findIndex(
    c => c.community.toString() === communityId
  );
  
  if (communityIndex >= 0) {
    // Update existing community entry
    user.communities[communityIndex].role = 'member';
    user.communities[communityIndex].subscription = subscriptionData;
  } else {
    // Add new community entry
    user.communities.push({
      community: communityId,
      role: 'member',
      joinedAt: now,
      notifications: true,
      subscription: subscriptionData
    });
  }
  
  await user.save();
}

/**
 * Update community membership with session support for atomic transactions
 * @param {Object} options - Membership update options
 * @param {String} options.userId - User ID
 * @param {String} options.communityId - Community ID
 * @param {String} options.transactionId - Transaction ID
 * @param {String} options.paymentMethod - Payment method used
 * @param {Object} options.session - Mongoose session for transaction
 */
async function updateCommunityMembershipWithSession({ userId, communityId, transactionId, paymentMethod, session }) {
  const community = await Community.findById(communityId).session(session);
  const now = new Date();
  
  // Calculate subscription end date based on subscription type
  const subscriptionType = community.settings.payment.subscriptionType || 'one_time';
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

  // Add or update membership
  const memberIndex = community.members.findIndex(m => m.user.toString() === userId);
  
  if (memberIndex >= 0) {
    // Update existing membership
    community.members[memberIndex].subscription = {
      type: subscriptionType,
      startDate: now,
      endDate,
      isActive: true,
      paymentMethod,
      transactionId
    };
    community.members[memberIndex].status = 'active';
  } else {
    // Add new member
    community.members.push({
      user: userId,
      status: 'active',
      subscription: {
        type: subscriptionType,
        startDate: now,
        endDate,
        isActive: true,
        paymentMethod,
        transactionId
      }
    });
    community.memberCount += 1;
  }

  await community.save({ session });
  
  // Also update User.communities array for consistency
  const user = await User.findById(userId).session(session);
  const communityIndex = user.communities.findIndex(
    c => c.community.toString() === communityId
  );
  
  if (communityIndex >= 0) {
    // Update existing community entry
    user.communities[communityIndex].role = 'member';
    user.communities[communityIndex].subscription = {
      type: subscriptionType,
      startDate: now,
      endDate,
      isActive: true,
      paymentMethod,
      transactionId
    };
  } else {
    // Add new community entry
    user.communities.push({
      community: communityId,
      role: 'member',
      joinedAt: now,
      notifications: true,
      subscription: {
        type: subscriptionType,
        startDate: now,
        endDate,
        isActive: true,
        paymentMethod,
        transactionId
      }
    });
  }
  
  await user.save({ session });
}

async function transferToAekoWallet({ communityId, amount, reference, details }) {
  // In a real implementation, this would transfer to the admin's Aeko wallet
  // For now, we'll just simulate a successful transfer
  console.log(`Transferring ${amount} to admin's Aeko wallet for community ${communityId}`);
  console.log('Reference:', reference);
  console.log('Details:', details);
  
  return { success: true, message: 'Transfer successful' };
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
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const community = await Community.findById(communityId).session(session);
    
    if (!community) {
      throw new Error('Community not found');
    }

    // Find the withdrawal in history
    const withdrawal = community.settings.payment.withdrawalHistory.find(
      w => w.reference === reference
    );

    if (!withdrawal) {
      throw new Error('Withdrawal not found');
    }

    if (withdrawal.status !== 'pending') {
      throw new Error(`Withdrawal already ${withdrawal.status}`);
    }

    const amount = withdrawal.amount;

    if (success) {
      // Mark withdrawal as completed
      withdrawal.status = 'completed';
      withdrawal.processedAt = new Date();
      
      // Decrement pendingWithdrawals when withdrawal completes
      community.settings.payment.pendingWithdrawals = 
        Math.max(0, (community.settings.payment.pendingWithdrawals || 0) - amount);
      
      // Update availableForWithdrawal to reflect the completed withdrawal
      community.settings.payment.availableForWithdrawal = 
        Math.max(0, (community.settings.payment.availableForWithdrawal || 0) - amount);
    } else {
      // Mark withdrawal as failed
      withdrawal.status = 'failed';
      withdrawal.metadata = {
        ...withdrawal.metadata,
        error: errorMessage
      };
      
      // Decrement pendingWithdrawals when withdrawal fails (restore available balance)
      community.settings.payment.pendingWithdrawals = 
        Math.max(0, (community.settings.payment.pendingWithdrawals || 0) - amount);
    }

    await community.save({ session });
    await session.commitTransaction();

    return {
      success: true,
      message: `Withdrawal ${success ? 'completed' : 'failed'}`,
      withdrawal
    };
  } catch (error) {
    await session.abortTransaction();
    console.error('Withdrawal completion error:', error);
    throw error;
  } finally {
    session.endSession();
  }
};
