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
 *                 description: The media file (accepts 'file', 'media', 'image', or 'video' field names)
 *               type:
 *                 type: string
 *                 enum: [text, image, video]
 *               content:
 *                 type: string
 *               caption:
 *                 type: string
 *                 description: Optional caption/description for the status
 *               backgroundColor:
 *                 type: string
 *                 description: Tailwind gradient class for background
 *               font:
 *                 type: string
 *                 description: Tailwind font class
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
 *               caption:
 *                 type: string
 *                 description: Optional caption/description for the status
 *               backgroundColor:
 *                 type: string
 *                 description: Tailwind gradient class for background
 *               font:
 *                 type: string
 *                 description: Tailwind font class
 *     responses:
 *       201:
 *         description: Status created successfully
 *       400:
 *         description: Bad request
 */
router.post('/', authMiddleware, (req, res, next) => {
    // Support multiple field names for flexibility
    const uploadMiddleware = generalUpload.fields([
        { name: 'file', maxCount: 1 },
        { name: 'media', maxCount: 1 },
        { name: 'image', maxCount: 1 },
        { name: 'video', maxCount: 1 }
    ]);

    uploadMiddleware(req, res, (err) => {
        if (err) {
            console.error("Upload middleware error:", err);
            // Handle Multer errors specifically
            if (err.name === 'MulterError') {
                return res.status(400).json({ error: `Upload error: ${err.message}` });
            }
            return res.status(500).json({ error: "File upload failed" });
        }
        next();
    });
}, async (req, res) => {
  try {
    const userId = req.userId; // authMiddleware guarantees this
    let { type, content, caption, description, backgroundColor, font } = req.body;
    
    // Normalize caption/description
    const statusCaption = caption || description || null;

    // Handle file upload if present (check all possible field names)
    let uploadedFile = null;
    if (req.files) {
        uploadedFile = 
            (req.files.file && req.files.file[0]) || 
            (req.files.media && req.files.media[0]) || 
            (req.files.image && req.files.image[0]) || 
            (req.files.video && req.files.video[0]);
    }

    if (uploadedFile) {
      content = uploadedFile.path;
      // Infer type if not provided
      if (!type) {
        if (uploadedFile.mimetype.startsWith('image/')) type = 'image';
        else if (uploadedFile.mimetype.startsWith('video/')) type = 'video';
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
            caption: statusCaption,
            backgroundColor: backgroundColor || null,
            font: font || null,
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
 *                       caption:
 *                         type: string
 *                       backgroundColor:
 *                         type: string
 *                       font:
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
          additionalContent: statusObj.sharedPostData.shareInfo.additionalContent,
          caption: status.caption,
          backgroundColor: status.backgroundColor,
          font: status.font
        };
      } else {
        // For regular statuses
        statusObj.displayContent = {
          type: status.type,
          content: status.content,
          caption: status.caption,
          backgroundColor: status.backgroundColor,
          font: status.font
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

/**
 * @swagger
 * /api/status/{id}/reshare:
 *   post:
 *     summary: Reshare a status to your own story
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
 *         description: ID of the status to reshare
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               caption:
 *                 type: string
 *                 description: Optional caption/commentary for the reshare
 *               backgroundColor:
 *                 type: string
 *               font:
 *                 type: string
 *     responses:
 *       201:
 *         description: Status reshared successfully
 *       404:
 *         description: Original status not found
 */
router.post('/:id/reshare', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const { caption, backgroundColor, font } = req.body;
    
    // Fetch original status with author info
    const originalStatus = await prisma.status.findUnique({
        where: { id: req.params.id },
        include: {
            users: {
                select: { id: true, username: true, profilePicture: true, name: true, blueTick: true, goldenTick: true }
            }
        }
    });
    
    if (!originalStatus) {
        return res.status(404).json({ error: 'Status not found' });
    }

    // Check expiration
    if (new Date(originalStatus.expiresAt) < new Date()) {
        return res.status(400).json({ error: 'Cannot reshare expired status' });
    }

    // Verify privacy/blocking
    const BlockingService = (await import('../services/blockingService.js')).default;
    const canInteract = await BlockingService.enforceBlockingRules(userId, originalStatus.userId);
    
    if (!canInteract) {
        return res.status(403).json({ error: 'Cannot reshare this status due to privacy settings' });
    }

    // Prepare original content snapshot
    // Determine media/text based on type
    let originalMedia = null;
    let originalText = null;

    if (originalStatus.type === 'text') {
        originalText = originalStatus.content;
    } else {
        originalMedia = originalStatus.content;
        originalText = originalStatus.caption; // Use caption as text for media posts
    }

    const originalContent = {
        creator: originalStatus.users,
        text: originalText,
        media: originalMedia,
        type: originalStatus.type,
        createdAt: originalStatus.createdAt,
        originalId: originalStatus.id
    };

    const shareMetadata = {
        sharedBy: userId,
        sharedAt: new Date(),
        originalStatusId: originalStatus.id
    };

    // Create new status
    const newStatus = await prisma.status.create({
        data: {
            userId,
            type: 'shared_post', // Using shared_post type for compatibility
            content: caption || '', // The user's commentary becomes the content
            caption: null, // We use content for the new commentary
            backgroundColor: backgroundColor || originalStatus.backgroundColor,
            font: font || originalStatus.font,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            reactions: [],
            originalContent,
            shareMetadata,
            sharedPostId: null // It's a status, not a permanent post
        }
    });

    res.status(201).json({ success: true, status: newStatus });
  } catch (error) {
    console.error('Reshare status error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
