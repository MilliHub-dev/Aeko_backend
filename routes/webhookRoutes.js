import express from 'express';
import crypto from 'crypto';
import Stripe from 'stripe';
import prisma from '../config/db.js';
import { handleSubscriptionPaymentSuccess } from '../services/subscriptionPaymentService.js';
import { handleCommunityPaymentSuccess } from '../services/communityPaymentService.js';

const router = express.Router();
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

/**
 * Helper to dispatch payment success to correct service
 */
const processTransaction = async (transactionId) => {
    const transaction = await prisma.transaction.findUnique({ 
        where: { id: transactionId },
        select: { id: true, planId: true, communityId: true }
    });
    
    if (!transaction) {
        console.warn(`Transaction not found for ID: ${transactionId}`);
        return;
    }

    if (transaction.planId) {
        await handleSubscriptionPaymentSuccess(transaction.id);
    } else if (transaction.communityId) {
        await handleCommunityPaymentSuccess(transaction.id);
    } else {
        console.warn(`Unknown transaction type for ID: ${transactionId} (No planId or communityId)`);
    }
};

/**
 * @swagger
 * tags:
 *   name: Webhooks
 *   description: Payment webhook handlers
 */

/**
 * Paystack Webhook Handler
 * Verifies x-paystack-signature and processes charge.success events
 */
router.post('/paystack', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
        const signature = req.headers['x-paystack-signature'];
        if (!signature) {
             return res.status(400).send('No signature provided');
        }

        const rawBody = req.body;
        // Verify signature
        const hash = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
                           .update(rawBody)
                           .digest('hex');

        if (hash !== signature) {
            return res.status(400).send('Invalid signature');
        }

        const event = JSON.parse(rawBody.toString());

        if (event.event === 'charge.success') {
            const { reference, metadata } = event.data;
            // metadata might contain transactionId if we passed it during initialization
            const transactionId = metadata?.transactionId;

            if (transactionId) {
                await processTransaction(transactionId);
            } else {
                 // Fallback: look up by reference if transactionId is missing in metadata
                 const transaction = await prisma.transaction.findFirst({
                     where: { paymentReference: reference }
                 });
                 if (transaction) {
                     await processTransaction(transaction.id);
                 }
            }
        }

        res.sendStatus(200);
    } catch (error) {
        console.error('Paystack Webhook Error:', error);
        res.status(500).send('Webhook Error');
    }
});

/**
 * Stripe Webhook Handler
 * Verifies stripe-signature and processes payment_intent.succeeded events
 */
router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
        if (!stripe) return res.status(500).send('Stripe not configured');

        const sig = req.headers['stripe-signature'];
        if (!sig) return res.status(400).send('No signature provided');

        let event;
        try {
            // Use the raw body buffer for signature verification
            event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
        } catch (err) {
            console.error('Stripe Signature Verification Failed:', err.message);
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }

        if (event.type === 'payment_intent.succeeded') {
            const paymentIntent = event.data.object;
            const transactionId = paymentIntent.metadata.transactionId;
            
            if (transactionId) {
                await processTransaction(transactionId);
            }
        } 
        else if (event.type === 'checkout.session.completed') {
             const session = event.data.object;
             const transactionId = session.metadata.transactionId;
             if (transactionId) await processTransaction(transactionId);
        }

        res.json({received: true});
    } catch (error) {
        console.error('Stripe Webhook Error:', error);
        res.status(500).send('Webhook Error');
    }
});

export default router;
