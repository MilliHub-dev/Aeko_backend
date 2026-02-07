import express from "express";
import { prisma } from "../config/db.js";
import authMiddleware from "../middleware/authMiddleware.js";
import twoFactorMiddleware from "../middleware/twoFactorMiddleware.js";
import { initializeSubscriptionPayment, verifySubscriptionPayment } from "../services/subscriptionPaymentService.js";

const router = express.Router();

/**
 * @swagger
 * /api/subscription/initialize:
 *   post:
 *     summary: Initialize subscription payment
 *     tags: [Subscription]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - planId
 *               - paymentMethod
 *             properties:
 *               planId:
 *                 type: string
 *               paymentMethod:
 *                 type: string
 *                 enum: [paystack, stripe]
 *     responses:
 *       200:
 *         description: Payment initialized
 */
router.post("/initialize", authMiddleware, twoFactorMiddleware.requireTwoFactor(), async (req, res) => {
  try {
    const { planId, paymentMethod } = req.body;
    const userId = req.user.id || req.user._id;

    const result = await initializeSubscriptionPayment({
      userId,
      planId,
      paymentMethod
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error("Subscription Initialize Error:", error);
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /api/subscription/verify:
 *   get:
 *     summary: Verify subscription payment
 *     tags: [Subscription]
 *     parameters:
 *       - in: query
 *         name: reference
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: paymentMethod
 *         required: true
 *         schema:
 *           type: string
 *           enum: [paystack, stripe]
 *     responses:
 *       200:
 *         description: Payment verified
 */
router.get("/verify", async (req, res) => {
  try {
    const { reference, paymentMethod } = req.query;

    if (!reference || !paymentMethod) {
      return res.status(400).json({ success: false, message: "Missing reference or paymentMethod" });
    }

    const result = await verifySubscriptionPayment({
      reference,
      paymentMethod
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error("Subscription Verify Error:", error);
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /api/subscription/status:
 *   get:
 *     summary: Get current user subscription status
 *     tags: [Subscription]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Subscription status
 */
router.get("/status", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        subscriptionStatus: true,
        subscriptionExpiry: true,
        subscriptionPlanId: true,
        subscriptionPlan: true,
        goldenTick: true
      }
    });

    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
