import express from 'express';
import { PrismaClient } from '@prisma/client';
import authMiddleware from '../middleware/authMiddleware.js';

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
 * /api/support/tickets:
 *   post:
 *     summary: Create a support ticket
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [subject, description, category]
 *             properties:
 *               subject: { type: string }
 *               description: { type: string }
 *               category: { type: string, enum: [billing, technical, account, other] }
 *               priority: { type: string, enum: [low, medium, high], default: medium }
 *     responses:
 *       201:
 *         description: Ticket created
 */
router.post('/tickets', authMiddleware, async (req, res) => {
  try {
    const { subject, description, category, priority } = req.body;
    const userId = req.user.id;

    const ticket = await prisma.supportTicket.create({
      data: {
        userId,
        subject,
        description,
        category,
        priority: priority || 'medium'
      }
    });

    // Create initial message from description? 
    // Usually separate, but description is often the first message.
    // Let's keep description as ticket body, and messages as replies.

    res.status(201).json({ success: true, ticket });
  } catch (error) {
    console.error('Create ticket error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @swagger
 * /api/support/tickets:
 *   get:
 *     summary: Get user's tickets
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 */
router.get('/tickets', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const tickets = await prisma.supportTicket.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { messages: true }
        }
      }
    });
    res.json({ success: true, tickets });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/support/tickets/{id}:
 *   get:
 *     summary: Get ticket details and messages
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 */
router.get('/tickets/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            sender: {
              select: { id: true, username: true, name: true, profilePicture: true, isAdmin: true }
            }
          }
        },
        user: {
            select: { id: true, username: true, name: true, profilePicture: true }
        }
      }
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Access control: User owns ticket OR User is Admin
    if (ticket.userId !== userId && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ success: true, ticket });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/support/tickets/{id}/messages:
 *   post:
 *     summary: Add a message to a ticket
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 */
router.post('/tickets/:id/messages', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { message, attachments } = req.body;
    const senderId = req.user.id;

    const ticket = await prisma.supportTicket.findUnique({
      where: { id }
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Access control
    if (ticket.userId !== senderId && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // If user replies, status -> open/in_progress?
    // If admin replies, status -> resolved/waiting_for_user?
    // Let's just update updatedAt for now.

    const newMessage = await prisma.supportMessage.create({
      data: {
        ticketId: id,
        senderId,
        message,
        attachments: attachments || []
      },
      include: {
        sender: {
          select: { id: true, username: true, name: true, profilePicture: true, isAdmin: true }
        }
      }
    });

    // Auto-update status based on sender
    if (req.user.isAdmin) {
        await prisma.supportTicket.update({
            where: { id },
            data: { status: 'in_progress' }
        });
    } else {
        // If ticket was closed, maybe reopen it?
        if (ticket.status === 'closed' || ticket.status === 'resolved') {
            await prisma.supportTicket.update({
                where: { id },
                data: { status: 'open' }
            });
        }
    }

    res.status(201).json({ success: true, message: newMessage });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/support/tickets/{id}/status:
 *   patch:
 *     summary: Update ticket status
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 */
router.patch('/tickets/:id/status', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // open, in_progress, resolved, closed
    const userId = req.user.id;

    const ticket = await prisma.supportTicket.findUnique({
      where: { id }
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // User can only close/resolve. Admin can do anything.
    if (!req.user.isAdmin) {
        if (ticket.userId !== userId) {
            return res.status(403).json({ error: 'Access denied' });
        }
        if (status !== 'closed' && status !== 'resolved') {
             return res.status(403).json({ error: 'Users can only close or resolve tickets' });
        }
    }

    const updatedTicket = await prisma.supportTicket.update({
      where: { id },
      data: { status }
    });

    res.json({ success: true, ticket: updatedTicket });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== ADMIN ROUTES =====

/**
 * @swagger
 * /api/support/admin/tickets:
 *   get:
 *     summary: Get all tickets (Admin)
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 */
router.get('/admin/tickets', authMiddleware, checkAdmin, async (req, res) => {
  try {
    const { status, category, priority, page = 1, limit = 20 } = req.query;
    
    const where = {};
    if (status) where.status = status;
    if (category) where.category = category;
    if (priority) where.priority = priority;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [tickets, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, username: true, email: true, name: true, profilePicture: true }
          },
          _count: {
            select: { messages: true }
          }
        }
      }),
      prisma.supportTicket.count({ where })
    ]);

    res.json({
      success: true,
      tickets,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/support/admin/tickets/{id}/priority:
 *   patch:
 *     summary: Update ticket priority (Admin)
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 */
router.patch('/admin/tickets/:id/priority', authMiddleware, checkAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { priority } = req.body;

    const updatedTicket = await prisma.supportTicket.update({
      where: { id },
      data: { priority }
    });

    res.json({ success: true, ticket: updatedTicket });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
