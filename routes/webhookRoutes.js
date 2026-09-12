import express from 'express';
import crypto from 'crypto';
import Stripe from 'stripe';
import { prisma } from '../config/db.js';
import { handleSubscriptionPaymentSuccess } from '../services/subscriptionPaymentService.js';
import { handleCommunityPaymentSuccess } from '../services/communityPaymentService.js';
import { verifyWebhookSignature } from '../services/whopService.js';

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

/**
 * Whop Webhook Handler — the primary payment gateway.
 *
 * Whop signs `{webhook-id}.{webhook-timestamp}.{raw body}` with HMAC-SHA256,
 * so this route takes the body as a Buffer: a parsed-and-reserialised object
 * would not reproduce the signed bytes. `/api/webhooks` is mounted before
 * express.json() in server.js, which is what makes that possible.
 *
 * Idempotency is not optional here. Whop retries a failed delivery for about
 * three days, roughly ten attempts, and every retry carries the same
 * `webhook-id` — so without the WebhookEvent table a retry following a slow
 * but successful run would grant a subscription twice.
 *
 * Whop expects a 2xx within five seconds, so nothing slow happens before the
 * response: an event we cannot act on is still acknowledged, because asking
 * for a retry would not change the outcome.
 */
router.post('/whop', express.raw({ type: 'application/json' }), async (req, res) => {
    const webhookId = req.headers['webhook-id'];
    const timestamp = req.headers['webhook-timestamp'];
    const signature = req.headers['webhook-signature'];

    try {
        const check = verifyWebhookSignature({
            rawBody: req.body,
            webhookId,
            timestamp,
            signatureHeader: signature,
        });

        if (!check.valid) {
            // 401 rather than 400: this is an authentication failure, and Whop
            // should not keep retrying a request it cannot sign correctly.
            console.warn(`Whop webhook rejected: ${check.reason}`);
            return res.status(401).send(check.reason || 'Invalid signature');
        }

        const event = JSON.parse(req.body.toString());
        const eventType = event?.type;

        // Claim this delivery. The unique (provider, eventId) index makes the
        // insert the lock: if it fails, another attempt already handled it.
        try {
            await prisma.webhookEvent.create({
                data: {
                    provider: 'whop',
                    eventId: String(webhookId),
                    eventType: eventType ?? null,
                    payload: event ?? null,
                },
            });
        } catch (error) {
            if (error?.code === 'P2002') {
                console.log(`Whop webhook ${webhookId} already processed`);
                return res.sendStatus(200);
            }
            throw error;
        }

        // `metadata` set when the checkout was created comes back untouched,
        // which is how a Whop payment is tied to our own transaction row.
        const data = event?.data ?? {};
        const transactionId = data?.metadata?.transactionId;

        if (eventType === 'payment.succeeded') {
            // Record the Whop payment id before activating: the checkout
            // response carries a plan id, not a payment id, so this webhook is
            // the only place it becomes known. Without it the app's verify()
            // call after the browser closes could never confirm anything.
            if (transactionId && data?.id) {
                await prisma.transaction
                    .update({
                        where: { id: transactionId },
                        data: {
                            providerResponse: data,
                            metadata: {
                                ...(data?.metadata ?? {}),
                                whopPaymentId: data.id
                            }
                        }
                    })
                    .catch((error) => {
                        // Never block activation on bookkeeping.
                        console.warn('Could not record Whop payment id:', error.message);
                    });
            }

            if (transactionId) {
                await processTransaction(transactionId);
            } else {
                // Fall back to the reference, as the Paystack handler does.
                const reference =
                    data?.metadata?.reference || data?.id || null;
                const transaction = reference
                    ? await prisma.transaction.findFirst({
                          where: { paymentReference: String(reference) },
                      })
                    : null;
                if (transaction) {
                    await processTransaction(transaction.id);
                } else {
                    console.warn(
                        `Whop payment.succeeded with no resolvable transaction (webhook ${webhookId})`
                    );
                }
            }
        } else if (eventType === 'payment.failed') {
            if (transactionId) {
                await prisma.transaction.update({
                    where: { id: transactionId },
                    data: {
                        status: 'failed',
                        failureReason:
                            data?.substatus || data?.status || 'Payment failed',
                        providerResponse: data,
                    },
                });
            }
        } else {
            // Subscribed to more than we act on; acknowledge the rest so Whop
            // does not retry an event we have deliberately ignored.
            console.log(`Whop webhook ${eventType} received, no action taken`);
        }

        return res.sendStatus(200);
    } catch (error) {
        console.error('Whop Webhook Error:', error);
        // A 5xx asks Whop to retry, which is right for a transient failure —
        // the dedup row is only written once the signature has been verified.
        return res.status(500).send('Webhook Error');
    }
});

export default router;
