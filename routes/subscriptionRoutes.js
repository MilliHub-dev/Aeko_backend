import express from "express";
import { prisma } from "../config/db.js";
import authMiddleware from "../middleware/authMiddleware.js";
import adminMiddleware from "../middleware/adminMiddleware.js";
import twoFactorMiddleware from "../middleware/twoFactorMiddleware.js";
import { initializeSubscriptionPayment, verifySubscriptionPayment } from "../services/subscriptionPaymentService.js";

const router = express.Router();

/**
 * @swagger
 * /api/subscription/admin/all:
 *   get:
 *     summary: Get all subscribers (Admin only)
 *     tags: [Subscription]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *     responses:
 *       200:
 *         description: List of subscribers
 */
router.get("/admin/all", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const { status } = req.query;

    const where = {};
    if (status) {
      where.subscriptionStatus = status;
    } else {
      // Default to showing active subscriptions if not specified? 
      // Or show all. Let's show all but maybe filter by "not inactive" if desired.
      // For admin, seeing everyone is better.
      where.subscriptionStatus = { not: 'inactive' }; 
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          username: true,
          email: true,
          subscriptionStatus: true,
          subscriptionExpiry: true,
          subscriptionPlan: {
            select: { name: true, price: true }
          }
        },
        skip,
        take: limit,
        orderBy: { subscriptionExpiry: 'desc' }
      }),
      prisma.user.count({ where })
    ]);

    res.json({
      success: true,
      data: users,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("Admin Subscribers Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /api/subscription/admin/stats:
 *   get:
 *     summary: Get subscription statistics (Admin only)
 *     tags: [Subscription]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Subscription stats
 */
router.get("/admin/stats", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    // Group by plan
    const stats = await prisma.user.groupBy({
      by: ['subscriptionPlanId'],
      where: {
        subscriptionStatus: 'active'
      },
      _count: {
        _all: true
      }
    });

    // Get plan details to map names
    const plans = await prisma.subscriptionPlan.findMany();
    const planMap = plans.reduce((acc, plan) => {
      acc[plan.id] = plan;
      return acc;
    }, {});

    const formattedStats = stats.map(stat => ({
      planId: stat.subscriptionPlanId,
      planName: planMap[stat.subscriptionPlanId]?.name || 'Unknown',
      count: stat._count._all,
      estimatedRevenue: (planMap[stat.subscriptionPlanId]?.price || 0) * stat._count._all
    }));

    const totalSubscribers = formattedStats.reduce((acc, curr) => acc + curr.count, 0);
    const totalRevenue = formattedStats.reduce((acc, curr) => acc + curr.estimatedRevenue, 0);

    res.json({
      success: true,
      data: {
        byPlan: formattedStats,
        totalSubscribers,
        totalMonthlyRevenue: totalRevenue
      }
    });
  } catch (error) {
    console.error("Admin Stats Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

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