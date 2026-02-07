import axios from 'axios';
import dotenv from 'dotenv';
import { prisma } from "../config/db.js";
import Stripe from 'stripe';

dotenv.config();

// Initialize payment providers
const paystack = axios.create({
  baseURL: 'https://api.paystack.co',
  headers: {
    'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
    'Content-Type': 'application/json'
  }
});

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Retry helper function with exponential backoff
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
      
      const statusCode = error.response?.status || error.statusCode;
      if (statusCode >= 400 && statusCode < 500) {
        console.log(`[Retry Logic] Client error (${statusCode}), not retrying`);
        throw error;
      }
      
      if (attempt >= maxRetries) {
        console.log(`[Retry Logic] Max retries (${maxRetries}) reached, failing`);
        break;
      }
      
      const backoffMs = Math.pow(2, attempt) * 1000;
      console.log(`[Retry Logic] Attempt ${attempt + 1} failed, retrying in ${backoffMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, backoffMs));
    }
  }
  
  throw lastError;
}

/**
 * Initialize payment for Aeko subscription plan
 * @param {Object} options - Payment options
 * @param {String} options.userId - User ID
 * @param {String} options.planId - Subscription Plan ID
 * @param {String} options.paymentMethod - Payment method (paystack, stripe)
 * @returns {Promise<Object>} - Payment initialization response
 */
export const initializeSubscriptionPayment = async ({ userId, planId, paymentMethod }) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    if (!user.email) {
      throw new Error('User email is required for payment processing');
    }

    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan) {
      throw new Error('Subscription plan not found');
    }

    if (!plan.isActive) {
      throw new Error('This subscription plan is currently inactive');
    }

    // Check if user is already on this plan and active
    if (user.subscriptionPlanId === planId && user.subscriptionStatus === 'active') {
       if (user.subscriptionExpiry && new Date(user.subscriptionExpiry) > new Date()) {
          throw new Error('You are already subscribed to this plan');
       }
    }

    const amount = plan.price;
    const currency = plan.currency || 'USD';
    const reference = `SUB-${Date.now()}-${userId.substring(0, 6)}`;

    // Create transaction record
    const transaction = await prisma.transaction.create({
      data: {
        userId,
        planId,
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
          amount: amount * 100, // Paystack uses kobo/cents
          reference,
          metadata: {
            userId,
            planId,
            transactionId: transaction.id,
            type: 'subscription'
          }
        });

      case 'stripe':
        return await initializeStripePayment({
          amount,
          currency,
          description: `Subscription to ${plan.name}`,
          metadata: {
            userId,
            planId,
            transactionId: transaction.id,
            type: 'subscription'
          }
        });

      default:
        throw new Error('Unsupported payment method');
    }
  } catch (error) {
    console.error('Subscription payment initialization error:', error);
    throw error;
  }
};

/**
 * Verify subscription payment and update user status
 */
export const verifySubscriptionPayment = async ({ reference, paymentMethod }) => {
  try {
    const transaction = await prisma.transaction.findFirst({ where: { paymentReference: reference } });
    if (!transaction) {
      throw new Error('Transaction not found');
    }

    // Idempotency check
    if (transaction.status === 'completed') {
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
      await prisma.$transaction(async (tx) => {
        await updateUserSubscriptionWithTx({
          userId: transaction.userId,
          planId: transaction.planId,
          transactionId: transaction.id,
          tx
        });

        await tx.transaction.update({
          where: { id: transaction.id },
          data: { status: 'completed' }
        });
      });
    }

    return verificationResult;
  } catch (error) {
    console.error('Subscription payment verification error:', error);
    throw error;
  }
};

// --- Helper Functions ---

async function initializePaystackPayment({ email, amount, reference, metadata }) {
  try {
    const { result, retryCount } = await callWithRetry(async () => {
      return await paystack.post('/transaction/initialize', {
        email,
        amount,
        reference,
        metadata,
        callback_url: `${process.env.FRONTEND_URL}/subscription/callback` // Adjusted callback URL
      });
    }, 1);

    if (retryCount > 0 && metadata.transactionId) {
      await prisma.transaction.update({
        where: { id: metadata.transactionId },
        data: { retryCount }
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
    if (metadata.transactionId) {
        await prisma.transaction.update({
            where: { id: metadata.transactionId },
            data: { status: 'failed', failureReason: error.message }
        });
    }
    throw new Error('Failed to initialize Paystack payment');
  }
}

async function initializeStripePayment({ amount, currency, description, metadata }) {
  try {
    const { result: paymentIntent, retryCount } = await callWithRetry(async () => {
      return await stripe.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency: currency.toLowerCase(),
        description,
        metadata,
        automatic_payment_methods: { enabled: true },
      });
    }, 1);

    if (retryCount > 0 && metadata.transactionId) {
      await prisma.transaction.update({
        where: { id: metadata.transactionId },
        data: { retryCount }
      });
    }

    return {
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    };
  } catch (error) {
    console.error('Stripe initialization error:', error);
    if (metadata.transactionId) {
        await prisma.transaction.update({
            where: { id: metadata.transactionId },
            data: { status: 'failed', failureReason: error.message }
        });
    }
    throw new Error('Failed to initialize Stripe payment');
  }
}

async function verifyPaystackPayment(reference) {
  try {
    const { result: response } = await callWithRetry(async () => {
      return await paystack.get(`/transaction/verify/${reference}`);
    }, 1);
    
    if (response.data.data.status === 'success') {
      return { success: true, message: 'Payment verified successfully' };
    } else {
      return { success: false, message: 'Payment verification failed' };
    }
  } catch (error) {
    console.error('Paystack verification error:', error.response?.data || error.message);
    throw new Error('Failed to verify Paystack payment');
  }
}

async function verifyStripePayment(paymentIntentId) {
  try {
    const { result: paymentIntent } = await callWithRetry(async () => {
      return await stripe.paymentIntents.retrieve(paymentIntentId);
    }, 1);
    
    if (paymentIntent.status === 'succeeded') {
      return { success: true, message: 'Payment verified successfully' };
    } else {
      return { success: false, message: `Payment status: ${paymentIntent.status}` };
    }
  } catch (error) {
    console.error('Stripe verification error:', error);
    throw new Error('Failed to verify Stripe payment');
  }
}

async function updateUserSubscriptionWithTx({ userId, planId, transactionId, tx }) {
  const plan = await tx.subscriptionPlan.findUnique({ where: { id: planId } });
  const now = new Date();
  let endDate = new Date();
  
  // Handle duration
  if (plan.duration === 'yearly') {
    endDate.setFullYear(now.getFullYear() + 1);
  } else {
    // Default monthly
    endDate.setMonth(now.getMonth() + 1);
  }

  // Update user with new plan
  await tx.user.update({
    where: { id: userId },
    data: {
      subscriptionPlanId: planId,
      subscriptionStatus: 'active',
      subscriptionExpiry: endDate,
      goldenTick: true // As per user requirements for all paid plans
    }
  });
}
