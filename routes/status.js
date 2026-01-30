import express from 'express';
import { prisma } from "../config/db.js";
import authMiddleware from "../middleware/authMiddleware.js";
import BlockingMiddleware from "../middleware/blockingMiddleware.js";
import { generalUpload } from "../middleware/upload.js";

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
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               type:
 *                 type: string
 *                 enum: [text, image, video]
 *               content:
 *                 type: string
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
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
router.post('/', authMiddleware, generalUpload.single('file'), async (req, res) => {
  try {
    const userId = req.userId; // authMiddleware guarantees this
    let { type, content } = req.body;

    // Handle file upload if present
    if (req.file) {
      content = req.file.path;
      // Infer type if not provided
      if (!type) {
        if (req.file.mimetype.startsWith('image/')) type = 'image';
        else if (req.file.mimetype.startsWith('video/')) type = 'video';
      }
    }

    // Default to text if still undefined
    if (!type && content) {
        type = 'text';
    }

    if (!type || !content) {
        return res.status(400).json({ error: "Type and content (or file) are required" });
    }
    
    // Default expiration: 24 hours from now
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const newStatus = await prisma.status.create({
        data: {
            userId,
            type,
            content,
            expiresAt,
            reactions: [],
            originalContent: {},
            shareMetadata: {}
        }
    });
    res.status(201).json({ success: true, status: newStatus });
  } catch (error) {
    console.error('Create status error:', error);
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
    const statusesRaw = await prisma.status.findMany({
      where: { 
          expiresAt: { gt: new Date() } 
      },
      include: {
          users: {
              select: { id: true, username: true, profilePicture: true, name: true }
          },
          posts: {
              include: {
                  users_posts_userIdTouser: {
                      select: { id: true, username: true, profilePicture: true, name: true }
                  }
              }
          }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Map Prisma relations to expected frontend structure
    const statuses = statusesRaw.map(status => ({
        ...status,
        user: status.users,
        users: undefined,
        sharedPost: status.posts ? {
            ...status.posts,
            user: status.posts.users_posts_userIdTouser,
            users_posts_userIdTouser: undefined
        } : null,
        posts: undefined
    }));

    // Apply blocking filter
    const BlockingService = (await import('../services/blockingService.js')).default;
    const filteredStatuses = [];
    
    for (const status of statuses) {
      const authorId = status.userId;
      const canInteract = await BlockingService.enforceBlockingRules(requestingUserId, authorId);
      if (canInteract) {
        filteredStatuses.push(status);
      }
    }

    // Format statuses to include shared post information
    const formattedStatuses = filteredStatuses.map(status => {
      // Create a plain object
      const statusObj = { ...status };
      
      // Handle shared posts
      if (status.type === 'shared_post' && (status.sharedPost || status.originalContent)) {
        // Construct sharedPostData from Prisma relation or fallback to originalContent JSON
        // Prioritize relation if available, otherwise use stored snapshot
        
        // Note: originalContent is stored as JSON in Prisma model
        const originalContent = status.originalContent || {};
        const shareMetadata = status.shareMetadata || {};
        
        const originalCreator = status.sharedPost?.user || originalContent.creator;
        
        statusObj.sharedPostData = {
          originalPost: {
            content: status.sharedPost?.text || originalContent.text,
            media: status.sharedPost?.media || originalContent.media,
            type: status.sharedPost?.type || originalContent.type,
            creator: originalCreator,
            createdAt: status.sharedPost?.createdAt || originalContent.createdAt
          },
          shareInfo: {
            sharedAt: shareMetadata.sharedAt || status.createdAt,
            sharedBy: shareMetadata.sharedBy || status.user,
            additionalContent: status.content
          }
        };
        
        // Format the display content for shared posts (Legacy format support)
        statusObj.displayContent = {
          type: 'shared_post',
          originalCreator: statusObj.sharedPostData.originalPost.creator,
          originalContent: statusObj.sharedPostData.originalPost.content,
          originalMedia: statusObj.sharedPostData.originalPost.media,
          originalType: statusObj.sharedPostData.originalPost.type,
          originalCreatedAt: statusObj.sharedPostData.originalPost.createdAt,
          sharedBy: statusObj.sharedPostData.shareInfo.sharedBy,
          sharedAt: statusObj.sharedPostData.shareInfo.sharedAt,
          additionalContent: statusObj.sharedPostData.shareInfo.additionalContent
        };
      } else {
        // For regular statuses
        statusObj.displayContent = {
          type: status.type,
          content: status.content
        };
      }
      
      return statusObj;
    });

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
    const userId = req.userId;
    
    // Use deleteMany to ensure we only delete if it belongs to user
    const result = await prisma.status.deleteMany({
      where: {
        id: req.params.id,
        userId: userId
      }
    });

    if (result.count === 0) {
      return res.status(404).json({ error: 'Status not found or unauthorized' });
    }

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
    const userId = req.userId;
    const { emoji } = req.body;
    
    const status = await prisma.status.findUnique({
        where: { id: req.params.id }
    });
    
    if (!status) return res.status(404).json({ error: 'Status not found' });

    // Update reactions array (JSON field)
    // We need to fetch current reactions, append, and update.
    const currentReactions = Array.isArray(status.reactions) ? status.reactions : [];
    const newReactions = [...currentReactions, { userId, emoji, createdAt: new Date() }];

    await prisma.status.update({
        where: { id: req.params.id },
        data: {
            reactions: newReactions
        }
    });

    res.json({ success: true, message: 'Reaction added' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
