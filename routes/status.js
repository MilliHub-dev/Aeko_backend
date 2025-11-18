import express from 'express';
import jwt from 'jsonwebtoken';
import Status from '../models/Status.js';
import authMiddleware from "../middleware/authMiddleware.js";
import BlockingMiddleware from "../middleware/blockingMiddleware.js";
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 statuses:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       userId:
 *                         type: object
 *                       type:
 *                         type: string
 *                         enum: [text, image, video, shared_post]
 *                       content:
 *                         type: string
 *                       sharedPostData:
 *                         type: object
 *                         properties:
 *                           originalPost:
 *                             type: object
 *                           shareInfo:
 *                             type: object
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const requestingUserId = req.userId;
    
    // Find active statuses and populate user information
    const statuses = await Status.find({ expiresAt: { $gt: new Date() } })
      .populate('userId', 'username profilePic')
      .populate('originalContent.creator', 'username profilePic')
      .populate('shareMetadata.sharedBy', 'username profilePic')
      .sort({ createdAt: -1 });

    // Apply blocking filter
    const BlockingService = (await import('../services/blockingService.js')).default;
    const filteredStatuses = [];
    
    for (const status of statuses) {
      const authorId = status.userId._id || status.userId;
      const canInteract = await BlockingService.enforceBlockingRules(requestingUserId, authorId);
      if (canInteract) {
        filteredStatuses.push(status);
      }
    }

    // Format statuses to include shared post information
    const formattedStatuses = await Promise.all(filteredStatuses.map(async (status) => {
      const statusObj = status.toObject();
      
      // If this is a shared post, add formatted shared post data
      if (status.isSharedPost()) {
        const sharedPostData = await status.getSharedPostData();
        statusObj.sharedPostData = sharedPostData;
        
        // Format the display content for shared posts
        statusObj.displayContent = {
          type: 'shared_post',
          originalCreator: sharedPostData.originalPost.creator,
          originalContent: sharedPostData.originalPost.content,
          originalMedia: sharedPostData.originalPost.media,
          originalType: sharedPostData.originalPost.type,
          originalCreatedAt: sharedPostData.originalPost.createdAt,
          sharedBy: sharedPostData.shareInfo.sharedBy,
          sharedAt: sharedPostData.shareInfo.sharedAt,
          additionalContent: sharedPostData.shareInfo.additionalContent
        };
      } else {
        // For regular statuses, keep the original format
        statusObj.displayContent = {
          type: status.type,
          content: status.content
        };
      }
      
      return statusObj;
    }));

    res.json({ success: true, statuses: formattedStatuses });
  } catch (error) {
    console.error('Error fetching statuses:', error);
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
router.post('/:id/react', authMiddleware, BlockingMiddleware.checkPostInteraction(), async (req, res) => {
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
