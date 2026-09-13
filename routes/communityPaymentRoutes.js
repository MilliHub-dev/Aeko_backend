import express from 'express';
import { validationResult } from 'express-validator';
import { authenticate } from '../middleware/authMiddleware.js';
import { isCommunityAdmin } from '../middleware/communityMiddleware.js';
import * as paymentService from '../services/communityPaymentService.js';
import { prisma } from '../config/db.js';
import twoFactorMiddleware from '../middleware/twoFactorMiddleware.js';
import {
  validatePaymentInitialization,
  validatePaymentVerification,
  validateWithdrawalRequest
} from '../middleware/paymentValidation.js';

const router = express.Router();

/**
 * @swagger
 * /api/community/payment/initialize:
 *   post:
 *     summary: Initialize community payment
 *     description: Initialize payment for joining a paid community. Requires authentication.
 *     tags: [Community Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - communityId
 *             properties:
 *               communityId:
 *                 type: string
 *                 description: ID of the community to join
 *               paymentMethod:
 *                 type: string
 *                 enum: [whop]
 *                 deprecated: true
 *                 description: Optional. Whop is the only gateway; legacy values (paystack, stripe) are accepted and treated as whop.
 *     responses:
 *       200:
 *         description: Payment initialized successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 authorizationUrl:
 *                   type: string
 *                 reference:
 *                   type: string
 *       400:
 *         description: Invalid request or payment method not configured
 *       401:
 *         description: Unauthorized - authentication required
 *       404:
 *         description: Community or user not found
 */
router.post('/initialize', authenticate, validatePaymentInitialization, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        message: 'Validation failed',
        errors: errors.array() 
      });
    }

    const { communityId } = req.body;
    const userId = req.user.id;

    // Whop only; any paymentMethod sent by an older app build is ignored.
    const result = await paymentService.initializePayment({
      userId,
      communityId
    });

    res.json(result);
  } catch (error) {
    console.error('Payment initialization error:', error);
    res.status(400).json({ 
      success: false, 
      message: error.message || 'Failed to initialize payment' 
    });
  }
});

/**
 * @swagger
 * /api/community/payment/verify:
 *   get:
 *     summary: Verify community payment
 *     description: Confirms the payment with Whop and grants membership once. No authentication required as this is called from the checkout return. `pending` true means Whop has not confirmed the payment yet (the webhook may still be on its way) and is not a failure.
 *     tags: [Community Payments]
 *     parameters:
 *       - in: query
 *         name: reference
 *         required: true
 *         schema:
 *           type: string
 *         description: Payment reference from initialization
 *       - in: query
 *         name: paymentMethod
 *         required: false
 *         schema:
 *           type: string
 *           enum: [whop]
 *         description: Optional and ignored; every community payment is confirmed through Whop.
 *     responses:
 *       200:
 *         description: Verification result; membership is granted when `success` is true
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 pending:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Payment verification failed or invalid reference
 *       404:
 *         description: Transaction not found
 */
router.get('/verify', validatePaymentVerification, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        message: 'Validation failed',
        errors: errors.array() 
      });
    }

    const { reference } = req.query;

    const result = await paymentService.verifyPayment({ reference });

    res.json(result);
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(400).json({ 
      success: false, 
      message: error.message || 'Payment verification failed' 
    });
  }
});

/**
 * @swagger
 * /api/community/withdraw:
 *   post:
 *     summary: Request withdrawal of community earnings
 *     description: Request withdrawal of available community earnings. Only community owner can withdraw. Requires authentication and owner authorization.
 *     tags: [Community Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - communityId
 *               - amount
 *               - method
 *               - details
 *             properties:
 *               communityId:
 *                 type: string
 *                 description: ID of the community
 *               amount:
 *                 type: number
 *                 description: Amount to withdraw (must not exceed available balance)
 *                 minimum: 0.01
 *               method:
 *                 type: string
 *                 enum: [bank]
 *                 description: Withdrawal method
 *               details:
 *                 type: object
 *                 description: Withdrawal details (required for bank transfers)
 *                 properties:
 *                   accountNumber:
 *                     type: string
 *                   bankCode:
 *                     type: string
 *                   accountName:
 *                     type: string
 *     responses:
 *       200:
 *         description: Withdrawal request submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid request, insufficient balance, or invalid community ID
 *       401:
 *         description: Unauthorized - authentication required
 *       403:
 *         description: Forbidden - only community owner can withdraw
 *       404:
 *         description: Community not found
 */
router.post('/withdraw', authenticate, isCommunityAdmin, twoFactorMiddleware.requireTwoFactor(), validateWithdrawalRequest, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        message: 'Validation failed',
        errors: errors.array() 
      });
    }

    const { communityId, amount, method, details } = req.body;
    const adminId = req.user.id;

    const result = await paymentService.requestWithdrawal({
      communityId,
      adminId,
      amount: parseFloat(amount),
      method,
      details
    });

    res.json(result);
  } catch (error) {
    console.error('Withdrawal error:', error);
    res.status(400).json({ 
      success: false, 
      message: error.message || 'Withdrawal request failed' 
    });
  }
});

/**
 * @swagger
 * /api/community/{communityId}/transactions:
 *   get:
 *     summary: Get community transaction history with filtering and statistics
 *     description: Retrieve transaction history for a community with pagination and filtering. Only community owner can view transactions. Requires authentication and owner authorization.
 *     tags: [Community Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: communityId
 *         required: true
 *         schema:
 *           type: string
 *         description: Community ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *           minimum: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           minimum: 1
 *           maximum: 100
 *         description: Number of transactions per page (max 100)
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, completed, failed, refunded]
 *         description: Filter by transaction status
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter transactions from this date (ISO 8601 format, e.g., 2024-01-01)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter transactions until this date (ISO 8601 format, e.g., 2024-12-31)
 *     responses:
 *       200:
 *         description: Returns list of transactions with summary statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     transactions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           user:
 *                             type: object
 *                           amount:
 *                             type: number
 *                           status:
 *                             type: string
 *                           paymentMethod:
 *                             type: string
 *                           createdAt:
 *                             type: string
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalEarnings:
 *                           type: number
 *                         pending:
 *                           type: object
 *                         completed:
 *                           type: object
 *                         failed:
 *                           type: object
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         currentPage:
 *                           type: integer
 *                         totalPages:
 *                           type: integer
 *                         totalTransactions:
 *                           type: integer
 *       400:
 *         description: Invalid request parameters or community ID format
 *       401:
 *         description: Unauthorized - authentication required
 *       403:
 *         description: Forbidden - only community owner can view transactions
 *       404:
 *         description: Community not found
 *       500:
 *         description: Server error
 */
router.get('/:communityId/transactions', authenticate, isCommunityAdmin, async (req, res) => {
  try {
    const { communityId } = req.params;
    const { 
      page = 1, 
      limit = 10, 
      status, 
      startDate, 
      endDate 
    } = req.query;

    // Validate pagination parameters
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        success: false,
        message: 'Invalid pagination parameters. Page must be >= 1 and limit must be between 1 and 100.'
      });
    }

    // Build query filter
    const filter = { communityId: communityId };

    // Filter by status if provided
    if (status) {
      const validStatuses = ['pending', 'completed', 'failed', 'refunded'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        });
      }
      filter.status = status;
    }

    // Filter by date range if provided
    if (startDate || endDate) {
      filter.createdAt = {};
      
      if (startDate) {
        const start = new Date(startDate);
        if (isNaN(start.getTime())) {
          return res.status(400).json({
            success: false,
            message: 'Invalid startDate format. Use ISO 8601 format (e.g., 2024-01-01)'
          });
        }
        filter.createdAt.gte = start;
      }
      
      if (endDate) {
        const end = new Date(endDate);
        if (isNaN(end.getTime())) {
          return res.status(400).json({
            success: false,
            message: 'Invalid endDate format. Use ISO 8601 format (e.g., 2024-12-31)'
          });
        }
        // Set to end of day
        end.setHours(23, 59, 59, 999);
        filter.createdAt.lte = end;
      }
    }

    // Fetch transactions with pagination
    const [transactions, totalCount] = await Promise.all([
      prisma.transaction.findMany({
        where: filter,
        orderBy: { createdAt: 'desc' },
        take: limitNum,
        skip: (pageNum - 1) * limitNum,
        include: {
          user: {
            select: {
              username: true,
              email: true,
              name: true,
              profilePicture: true
            }
          }
        }
      }),
      prisma.transaction.count({ where: filter })
    ]);

    // Calculate summary statistics
    const summaryResults = await prisma.transaction.groupBy({
      by: ['status'],
      where: { communityId: communityId },
      _count: { _all: true },
      _sum: { amount: true }
    });

    // Build summary object
    const summary = {
      totalEarnings: 0,
      pending: { count: 0, amount: 0 },
      completed: { count: 0, amount: 0 },
      failed: { count: 0, amount: 0 },
      refunded: { count: 0, amount: 0 }
    };

    summaryResults.forEach(result => {
      const status = result.status;
      if (summary[status]) {
        summary[status].count = result._count._all;
        summary[status].amount = result._sum.amount || 0;
      }
      
      // Total earnings = completed transactions
      if (status === 'completed') {
        summary.totalEarnings = result._sum.amount || 0;
      }
    });

    res.status(200).json({
      success: true,
      data: {
        transactions,
        summary,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(totalCount / limitNum),
          totalTransactions: totalCount,
          limit: limitNum,
          hasNextPage: pageNum < Math.ceil(totalCount / limitNum),
          hasPrevPage: pageNum > 1
        }
      }
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    
    // Handle invalid ObjectId
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid community ID format'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;
