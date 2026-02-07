import express from 'express';
import { prisma } from '../config/db.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

// Middleware to ensure user is admin
const verifyAdmin = async (req, res, next) => {
  if (req.user && req.user.isAdmin) {
    next();
  } else {
    // Fallback check against DB if token doesn't have isAdmin
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (user && user.isAdmin) {
        next();
    } else {
        res.status(403).json({ message: 'Access denied. Admin only.' });
    }
  }
};

/**
 * @swagger
 * /api/subscription-plans:
 *   post:
 *     summary: Create a new subscription plan
 *     tags: [Subscription Plans]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - price
 *               - features
 *             properties:
 *               name:
 *                 type: string
 *               price:
 *                 type: number
 *               currency:
 *                 type: string
 *               duration:
 *                 type: string
 *                 enum: [monthly, yearly]
 *               features:
 *                 type: object
 *               limits:
 *                 type: object
 *               targetAudience:
 *                 type: string
 *     responses:
 *       201:
 *         description: Plan created successfully
 */
router.post('/', authMiddleware, verifyAdmin, async (req, res) => {
  try {
    const { name, price, currency, duration, features, limits, targetAudience } = req.body;

    const plan = await prisma.subscriptionPlan.create({
      data: {
        name,
        price,
        currency: currency || 'USD',
        duration: duration || 'monthly',
        features,
        limits,
        targetAudience
      }
    });

    res.status(201).json({ success: true, data: plan });
  } catch (error) {
    console.error('Create Plan Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /api/subscription-plans:
 *   get:
 *     summary: Get all subscription plans
 *     tags: [Subscription Plans]
 *     responses:
 *       200:
 *         description: List of plans
 */
router.get('/', async (req, res) => {
  try {
    const plans = await prisma.subscriptionPlan.findMany({
      orderBy: { price: 'asc' }
    });
    res.json({ success: true, data: plans });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /api/subscription-plans/{id}:
 *   put:
 *     summary: Update a subscription plan
 *     tags: [Subscription Plans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Plan updated
 */
router.put('/:id', authMiddleware, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const plan = await prisma.subscriptionPlan.update({
      where: { id },
      data: updateData
    });

    res.json({ success: true, data: plan });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /api/subscription-plans/{id}:
 *   delete:
 *     summary: Delete (or deactivate) a subscription plan
 *     tags: [Subscription Plans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Plan deactivated
 */
router.delete('/:id', authMiddleware, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    // Soft delete usually better for plans with history
    const plan = await prisma.subscriptionPlan.update({
      where: { id },
      data: { isActive: false }
    });

    res.json({ success: true, message: 'Plan deactivated successfully', data: plan });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
