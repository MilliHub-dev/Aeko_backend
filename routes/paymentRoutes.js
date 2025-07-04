import express from 'express';
import { initiatePayment, verifyPayment } from '../services/paymentService.js';

const router = express.Router();

/**
 *  @swagger
 * /api/payments/initiate:
 *   post:
 *     summary: Initiate a payment
 *     description: Initiates a payment and returns a payment link
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *                 description: Amount to be paid
 *               currency:
 *                 type: string
 *                 description: Currency for the payment
 *             required:
 *               - amount
 *               - currency
 *     responses:
 *       200:
 *         description: Payment link generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 link:
 *                   type: string
 *                   description: Payment link
 *       400:
 *         description: Bad request
 * 
 * /api/payments/verify:
 *   get:
 *     summary: Verify a payment
 *     description: Verifies the payment status using the payment ID
 *     parameters:
 *       - in: query
 *         name: paymentId
 *         required: true
 *         description: ID of the payment to verify
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Payment verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   description: Status of the payment (e.g., "successful", "failed")
 *                 amount:
 *                   type: number
 *                   description: Amount paid
 *                 currency:
 *                   type: string
 *                   description: Currency used in the transaction
 *       400:
 *         description: Bad request
 */

router.post('/pay', initiatePayment);
router.get('/verify', verifyPayment);

export default router;
