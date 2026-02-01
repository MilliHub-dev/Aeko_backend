import express from 'express';
import { PrismaClient } from '@prisma/client';
import authMiddleware from '../middleware/authMiddleware.js';
import emailService from '../services/emailService.js';

const prisma = new PrismaClient();
const router = express.Router();

// Helper to check if user is admin
const checkAdmin = (req, res, next) => {
  if (req.user && req.user.isAdmin) {
    next();
  } else {
    res.status(403).json({ error: 'Access denied. Admin only.' });
  }
};

/**
 * @swagger
 * /api/reports:
 *   post:
 *     summary: Create a report
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [entityId, entityType, reason]
 *             properties:
 *               entityId: { type: string }
 *               entityType: { type: string, enum: [USER, POST, COMMENT] }
 *               reason: { type: string }
 *               reportedId: { type: string, description: "ID of the user being reported" }
 *     responses:
 *       201:
 *         description: Report created
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { entityId, entityType, reason, reportedId } = req.body;
    const reporterId = req.user.id;

    if (!['USER', 'POST', 'COMMENT'].includes(entityType)) {
      return res.status(400).json({ error: 'Invalid entity type' });
    }

    const report = await prisma.report.create({
      data: {
        reporterId,
        reportedId: reportedId || null,
        entityId,
        entityType,
        reason
      }
    });

    res.status(201).json({ success: true, message: 'Report submitted successfully', report });
  } catch (error) {
    console.error('Create report error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @swagger
 * /api/reports:
 *   get:
 *     summary: Get all reports (Admin only)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', authMiddleware, checkAdmin, async (req, res) => {
  try {
    const reports = await prisma.report.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        reporter: { select: { id: true, username: true, email: true } },
        reported: { select: { id: true, username: true, email: true, warningCount: true, banned: true } }
      }
    });
    res.json({ success: true, reports });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/reports/{userId}/warn:
 *   post:
 *     summary: Warn a user (Admin only)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:userId/warn', authMiddleware, checkAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        warningCount: { increment: 1 }
      }
    });

    // Attempt to create notification
    try {
      await prisma.notification.create({
        data: {
          recipientId: userId,
          senderId: req.user.id,
          type: 'SYSTEM',
          title: 'Warning Issued',
          message: `You have received a warning: ${reason || 'Violation of community guidelines'}. Total warnings: ${user.warningCount}`,
          entityId: userId,
          entityType: 'USER'
        }
      });

      // Send email notification
      if (user.email) {
        await emailService.sendWarningEmail(
          user.email, 
          user.username || 'User', 
          reason || 'Violation of community guidelines', 
          user.warningCount
        );
      }
    } catch (notifError) {
      console.error("Failed to create warning notification/email:", notifError);
    }

    res.json({ success: true, message: 'User warned', warningCount: user.warningCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/reports/{userId}/ban:
 *   post:
 *     summary: Ban a user (Admin only)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:userId/ban', authMiddleware, checkAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        banned: true
      }
    });

    try {
        await prisma.notification.create({
        data: {
            recipientId: userId,
            senderId: req.user.id,
            type: 'SYSTEM',
            title: 'Account Suspended',
            message: `Your account has been suspended. Reason: ${reason || 'Violation of terms'}.`,
            entityId: userId,
            entityType: 'USER'
        }
        });
    } catch (notifError) {
        console.error("Failed to create ban notification:", notifError);
    }

    res.json({ success: true, message: 'User banned' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
