import express from 'express';
import { prisma } from '../config/db.js';

const router = express.Router();

const isValidEmail = (email) => {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

/**
 * @swagger
 * /api/waitlist:
 *   post:
 *     summary: Join the waitlist
 *     tags: [Waitlist]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Jane Doe
 *               email:
 *                 type: string
 *                 format: email
 *                 example: jane@example.com
 *     responses:
 *       201:
 *         description: Joined waitlist successfully
 *       400:
 *         description: Invalid request
 *       409:
 *         description: Email already exists in waitlist
 */
router.post('/', async (req, res) => {
  try {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';

    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: 'Name and email are required'
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'A valid email address is required'
      });
    }

    const existingEntry = await prisma.waitlistEntry.findUnique({
      where: { email }
    });

    if (existingEntry) {
      return res.status(409).json({
        success: false,
        message: 'This email is already on the waitlist'
      });
    }

    const entry = await prisma.waitlistEntry.create({
      data: {
        name,
        email
      }
    });

    res.status(201).json({
      success: true,
      message: 'Joined waitlist successfully',
      data: entry
    });
  } catch (error) {
    console.error('Waitlist signup error:', error);
    res.status(500).json({
      success: false,
      message: 'Error joining waitlist',
      error: error.message
    });
  }
});

export default router;
