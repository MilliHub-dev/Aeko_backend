import express from 'express';
import jwt from 'jsonwebtoken';
import Status from '../models/Status.js';
import authMiddleware from "../middleware/authMiddleware.js";
const router = express.Router();


/**
 * @swagger
 * /api/status:
 *   post:
 *     summary: Create a new status (image, text, or video)
 *     tags:
 *       - Status
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - content
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [text, image, video]
 *               content:
 *                 type: string
 *     responses:
 *       201:
 *         description: Status created successfully
 *       400:
 *         description: Bad request
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { type, content } = req.body;
    const newStatus = await Status.create({ userId: req.userId, type, content });
    res.status(201).json({ success: true, status: newStatus });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/status:
 *   get:
 *     summary: Get active statuses from followers
 *     tags:
 *       - Status
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of active statuses
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const statuses = await Status.find({ expiresAt: { $gt: new Date() } }).populate('userId', 'username profilePic');
    res.json({ success: true, statuses });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/status/{id}:
 *   delete:
 *     summary: Delete a status
 *     tags:
 *       - Status
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
 *         description: Status deleted successfully
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const status = await Status.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!status) return res.status(404).json({ error: 'Status not found' });

    res.json({ success: true, message: 'Status deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/status/{id}/react:
 *   post:
 *     summary: React to a status
 *     tags:
 *       - Status
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
 *             required:
 *               - emoji
 *             properties:
 *               emoji:
 *                 type: string
 *     responses:
 *       200:
 *         description: Reaction added successfully
 */
router.post('/:id/react', authMiddleware, async (req, res) => {
  try {
    const { emoji } = req.body;
    const status = await Status.findById(req.params.id);
    if (!status) return res.status(404).json({ error: 'Status not found' });

    status.reactions.push({ userId: req.userId, emoji });
    await status.save();

    res.json({ success: true, message: 'Reaction added' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
