import express from "express";
import mongoose from "mongoose";
import Post from "../models/Post.js";
import upload from "../middleware/upload.js";
import authMiddleware from "../middleware/authMiddleware.js";
import privacyFilterMiddleware from "../middleware/privacyMiddleware.js";
import BlockingMiddleware from "../middleware/blockingMiddleware.js";
import SecurityMiddleware from "../middleware/securityMiddleware.js";

const router = express.Router();

// Helper to sanitize and validate ObjectId strings
const normalizeObjectId = (value) => {
  if (!value || typeof value !== "string") return null;
  // Remove common wrapper characters like braces or quotes
  const cleaned = value.trim().replace(/^\{+|\}+$/g, "").replace(/^"+|"+$/g, "");
  return mongoose.Types.ObjectId.isValid(cleaned) ? cleaned : null;
};

// Helper to inject Cloudinary transformation into URLs
const transformCloudinaryUrl = (url, transformation) => {
  if (!url || typeof url !== 'string') return url;
  // Only attempt for Cloudinary URLs that contain '/upload/'
  const marker = '/upload/';
  const idx = url.indexOf(marker);
  if (idx === -1 || !transformation) return url;
  // Avoid duplicate insertions if transformation already present
  if (url.slice(idx + marker.length).startsWith('e_')) return url;
  return url.slice(0, idx + marker.length) + transformation + '/' + url.slice(idx + marker.length);
};

/**
 * @swagger
 * /api/posts/create:
 *   post:
 *     summary: Create a new post
 *     description: Creates a new post with text, image, or video and privacy controls
 *     tags:
 *       - Posts
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               text:
 *                 type: string
 *                 description: Optional caption text
 *                 example: "Hello Aeko!"
 *               type:
 *                 type: string
 *                 enum: [text, image, video]
 *                 description: Optional. If omitted, it will be inferred from uploaded file (image/video) or defaults to 'text' if no file is sent
 *                 example: text
 *               privacy:
 *                 type: string
 *                 enum: [public, followers, select_users, only_me]
 *                 description: Privacy level for the post (defaults to 'public')
 *                 example: public
 *               selectedUsers:
 *                 type: string
 *                 description: JSON array of user IDs for 'select_users' privacy (required when privacy is 'select_users')
 *                 example: '["userId1", "userId2"]'
 *               media:
 *                 type: string
 *                 format: binary
 *                 description: Media file for image/video posts (required if inferred or specified type is 'image' or 'video')
 *           encoding:
 *             media:
 *               contentType: [image/*, video/*]
 *           example:
 *             text: "Hello Aeko!"
 *             type: text
 *             privacy: public
 *           examples:
 *             textPost:
 *               summary: Create a text-only post
 *               value:
 *                 text: "Hello Aeko!"
 *                 privacy: public
 *             imagePost:
 *               summary: Create an image post
 *               value:
 *                 type: image
 *                 text: "My picture"
 *                 privacy: followers
 *             videoPost:
 *               summary: Create a video post with selected users
 *               value:
 *                 type: video
 *                 text: "My video"
 *                 privacy: select_users
 *                 selectedUsers: '["userId1", "userId2"]'
 *     responses:
 *       201:
 *         description: Post created successfully
 *       400:
 *         description: Bad request - Invalid privacy parameters or missing required fields
 *       500:
 *         description: Server error
 */
// Create a new post (text/image/video)
router.post("/create", authMiddleware,
  // Wrap multer to return JSON on errors instead of HTML
  (req, res, next) => {
    upload.single("media")(req, res, (err) => {
      if (err) {
        const status = err.name === 'MulterError' ? 400 : 500;
        return res.status(status).json({ error: err.message || 'Upload failed' });
      }
      next();
    });
  },
  async (req, res) => {
  try {
    const user = req.userId || req.user?.id || req.user?._id;
    const { text = "", type: rawType, privacy = "public", selectedUsers: rawSelectedUsers } = req.body;

    // Infer type if not provided
    let type = rawType;
    if (!type) {
      if (req.file?.mimetype?.startsWith('image/')) type = 'image';
      else if (req.file?.mimetype?.startsWith('video/')) type = 'video';
      else type = 'text';
    }

    if (!['text', 'image', 'video'].includes(type)) {
      return res.status(400).json({ error: "Invalid type. Must be one of: text, image, video" });
    }

    // For image/video, a media file must be provided
    if ((type === 'image' || type === 'video') && !req.file) {
      return res.status(400).json({ error: "Media file is required for image/video posts" });
    }

    // Validate privacy parameter
    const validPrivacyLevels = ['public', 'followers', 'select_users', 'only_me'];
    if (!validPrivacyLevels.includes(privacy)) {
      return res.status(400).json({ 
        error: "Invalid privacy level. Must be one of: public, followers, select_users, only_me" 
      });
    }

    // Parse and validate selectedUsers for select_users privacy
    let selectedUsers = [];
    if (privacy === 'select_users') {
      if (!rawSelectedUsers) {
        return res.status(400).json({ 
          error: "selectedUsers is required when privacy is set to 'select_users'" 
        });
      }

      try {
        selectedUsers = JSON.parse(rawSelectedUsers);
        if (!Array.isArray(selectedUsers)) {
          return res.status(400).json({ 
            error: "selectedUsers must be a JSON array of user IDs" 
          });
        }

        if (selectedUsers.length === 0) {
          return res.status(400).json({ 
            error: "At least one user must be selected for 'select_users' privacy" 
          });
        }

        // Validate that all selectedUsers are valid ObjectIds
        for (const userId of selectedUsers) {
          if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ 
              error: `Invalid user ID format: ${userId}` 
            });
          }
        }
      } catch (parseError) {
        return res.status(400).json({ 
          error: "selectedUsers must be a valid JSON array" 
        });
      }
    }

    const mediaPath = req.file ? req.file.path : ""; // Cloudinary storage exposes URL in file.path

    // Create post with privacy settings
    const postData = {
      user,
      type,
      text,
      media: mediaPath,
      privacy: {
        level: privacy,
        selectedUsers: privacy === 'select_users' ? selectedUsers : [],
        updatedAt: new Date(),
        updateHistory: [{
          previousLevel: null,
          newLevel: privacy,
          updatedAt: new Date(),
          updatedBy: user
        }]
      }
    };

    const newPost = new Post(postData);
    await newPost.save();
    
    // Re-fetch populated to ensure proper serialization
    const populated = await Post.findById(newPost._id)
      .populate('user', 'name email username profilePicture')
      .populate('privacy.selectedUsers', 'name username');
    
    res.status(201).json({
      ...populated.toObject(),
      likesCount: populated.likes?.length || 0,
      commentsCount: populated.comments?.length || 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/posts/{postId}/privacy:
 *   put:
 *     summary: Update privacy settings for a post
 *     description: Updates the privacy level and selected users for a post. Only the post creator can update privacy settings.
 *     tags:
 *       - Posts
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         description: ID of the post to update privacy for
 *         schema:
 *           type: string
 *           pattern: '^[a-fA-F0-9]{24}$'
 *           example: '68cad398b391bdd7d991d5c7'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - privacy
 *             properties:
 *               privacy:
 *                 type: string
 *                 enum: [public, followers, select_users, only_me]
 *                 description: New privacy level for the post
 *                 example: followers
 *               selectedUsers:
 *                 type: array
 *                 items:
 *                   type: string
 *                   pattern: '^[a-fA-F0-9]{24}$'
 *                 description: Array of user IDs for 'select_users' privacy (required when privacy is 'select_users')
 *                 example: ["68cad398b391bdd7d991d5c7", "68cad398b391bdd7d991d5c8"]
 *           examples:
 *             makePrivate:
 *               summary: Make post private (only me)
 *               value:
 *                 privacy: only_me
 *             makeFollowersOnly:
 *               summary: Make post visible to followers only
 *               value:
 *                 privacy: followers
 *             selectSpecificUsers:
 *               summary: Make post visible to specific users
 *               value:
 *                 privacy: select_users
 *                 selectedUsers: ["68cad398b391bdd7d991d5c7", "68cad398b391bdd7d991d5c8"]
 *     responses:
 *       200:
 *         description: Privacy settings updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Privacy settings updated successfully"
 *                 post:
 *                   type: object
 *                   description: Updated post object with new privacy settings
 *       400:
 *         description: Bad request - Invalid privacy parameters or missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "selectedUsers is required when privacy is set to 'select_users'"
 *       403:
 *         description: Not authorized to update privacy for this post
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Not authorized to update privacy for this post"
 *       404:
 *         description: Post not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Post not found"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Internal server error"
 */
router.put("/:postId/privacy", authMiddleware, async (req, res) => {
  try {
    const postId = normalizeObjectId(req.params.postId);
    if (!postId) {
      return res.status(400).json({ error: "Invalid postId format" });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    const userId = req.userId || req.user?.id || req.user?._id;
    
    // Only the post creator can update privacy settings
    if (post.user.toString() !== String(userId)) {
      return res.status(403).json({ error: "Not authorized to update privacy for this post" });
    }

    const { privacy, selectedUsers = [] } = req.body;

    // Validate privacy parameter
    const validPrivacyLevels = ['public', 'followers', 'select_users', 'only_me'];
    if (!privacy || !validPrivacyLevels.includes(privacy)) {
      return res.status(400).json({ 
        error: "Invalid privacy level. Must be one of: public, followers, select_users, only_me" 
      });
    }

    // Validate selectedUsers for select_users privacy
    if (privacy === 'select_users') {
      if (!selectedUsers || !Array.isArray(selectedUsers) || selectedUsers.length === 0) {
        return res.status(400).json({ 
          error: "selectedUsers is required and must be a non-empty array when privacy is set to 'select_users'" 
        });
      }

      // Validate that all selectedUsers are valid ObjectIds
      for (const userIdToCheck of selectedUsers) {
        if (!mongoose.Types.ObjectId.isValid(userIdToCheck)) {
          return res.status(400).json({ 
            error: `Invalid user ID format: ${userIdToCheck}` 
          });
        }
      }
    }

    // Use the Post model's updatePrivacy method to handle the update and audit trail
    await post.updatePrivacy(privacy, selectedUsers, userId);

    // Fetch the updated post with populated fields
    const updatedPost = await Post.findById(postId)
      .populate('user', 'name email username profilePicture')
      .populate('privacy.selectedUsers', 'name username')
      .populate('privacy.updateHistory.updatedBy', 'name username');

    res.json({
      success: true,
      message: "Privacy settings updated successfully",
      post: {
        ...updatedPost.toObject(),
        likesCount: updatedPost.likes?.length || 0,
        commentsCount: updatedPost.comments?.length || 0
      }
    });

  } catch (error) {
    // Handle validation errors from the Post model
    if (error.message === 'Invalid privacy level' || 
        error.message === 'Selected users must be provided for select_users privacy level') {
      return res.status(400).json({ error: error.message });
    }
    
    console.error('Privacy update error:', error);
    res.status(500).json({ error: "Internal server error" });
  }
});
/**

 * @swagger
 * /api/posts/{postId}:
 *   get:
 *     summary: Get a single post by ID
 *     tags:
 *       - Posts
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         description: ID of the post
 *         schema:
 *           type: string
 *           pattern: '^[a-fA-F0-9]{24}$'
 *           example: '68cad398b391bdd7d991d5c7'
 *     responses:
 *       200:
 *         description: Post retrieved successfully
 *       400:
 *         description: Invalid postId format
 *       404:
 *         description: Post not found
 *       500:
 *         description: Error retrieving post
 */

/**
 * @swagger
 * /api/posts/{postId}/reposts:
 *   get:
 *     summary: Get reposts of a specific post
 *     tags:
 *       - Posts
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         description: ID of the original post
 *         schema:
 *           type: string
 *           pattern: '^[a-fA-F0-9]{24}$'
 *           example: '68cad398b391bdd7d991d5c7'
 *     responses:
 *       200:
 *         description: List of reposts retrieved successfully
 *       400:
 *         description: Invalid postId format
 *       500:
 *         description: Error retrieving reposts
 */
router.get("/:postId/reposts", authMiddleware, async (req, res) => {
  try {
    const postId = normalizeObjectId(req.params.postId);
    if (!postId) return res.status(400).json({ error: "Invalid postId format" });
    const reposts = await Post.find({ originalPost: postId })
      .populate("user", "name email username profilePicture")
      .sort({ createdAt: -1 });
    res.json(reposts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/posts/{postId}/share-to-status:
 *   post:
 *     summary: Share an existing post to status
 *     description: Creates a new status entry that references and preserves the original post content. The shared status will expire after 24 hours like regular statuses.
 *     tags:
 *       - Posts
 *       - Status
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         description: ID of the post to share to status
 *         schema:
 *           type: string
 *           pattern: '^[a-fA-F0-9]{24}$'
 *           example: '68cad398b391bdd7d991d5c7'
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               additionalContent:
 *                 type: string
 *                 description: Optional additional text to add to the shared status
 *                 example: "Check out this amazing post!"
 *           examples:
 *             withComment:
 *               summary: Share with additional comment
 *               value:
 *                 additionalContent: "This is so inspiring!"
 *             withoutComment:
 *               summary: Share without additional comment
 *               value: {}
 *     responses:
 *       201:
 *         description: Post shared to status successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Post shared to status successfully"
 *                 status:
 *                   type: object
 *                   description: The created status object with shared post information
 *       400:
 *         description: Invalid postId format
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Invalid postId format"
 *       403:
 *         description: User does not have permission to view/share this post
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "You don't have permission to share this post"
 *       404:
 *         description: Post not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Post not found"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Internal server error"
 */
router.post("/:postId/share-to-status", authMiddleware, ...SecurityMiddleware.postOperations(), async (req, res) => {
  try {
    const postId = normalizeObjectId(req.params.postId);
    if (!postId) {
      return res.status(400).json({ error: "Invalid postId format" });
    }

    // Find the original post
    const originalPost = await Post.findById(postId).populate('user', 'username profilePicture');
    if (!originalPost) {
      return res.status(404).json({ error: "Post not found" });
    }

    const userId = req.userId || req.user?.id || req.user?._id;
    
    // Check if the requesting user can access the original post
    const canAccess = await originalPost.canUserAccess(userId);
    if (!canAccess) {
      return res.status(403).json({ error: "You don't have permission to share this post" });
    }

    // Import Status model
    const Status = (await import("../models/Status.js")).default;

    // Get additional content from request body
    const { additionalContent = '' } = req.body;

    // Create shared status using the Status model's static method
    const sharedStatus = await Status.createSharedPostStatus(
      postId, 
      userId, 
      additionalContent
    );

    // Populate the created status with user information
    await sharedStatus.populate([
      { path: 'userId', select: 'username profilePicture' },
      { path: 'originalContent.creator', select: 'username profilePicture' }
    ]);

    res.status(201).json({
      success: true,
      message: "Post shared to status successfully",
      status: sharedStatus
    });

  } catch (error) {
    console.error('Share to status error:', error);
    
    // Handle specific error messages from the Status model
    if (error.message === 'Original post not found') {
      return res.status(404).json({ error: "Post not found" });
    }
    
    if (error.message === 'User does not have permission to share this post') {
      return res.status(403).json({ error: "You don't have permission to share this post" });
    }
    
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @swagger
 * /api/posts/{postId}/promote:
 *   post:
 *     summary: Promote an existing post as an advertisement
 *     description: Marks a post as promoted and sets advertising parameters like budget and schedule
 *     tags:
 *       - Advertisements
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         description: ID of the post to promote
 *         schema:
 *           type: string
 *           pattern: '^[a-fA-F0-9]{24}$'
 *           example: '68cad398b391bdd7d991d5c7'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               budget:
 *                 type: number
 *                 example: 100
 *               target:
 *                 type: string
 *                 example: "sports, gaming, tech"
 *               startDate:
 *                 type: string
 *                 format: date-time
 *                 example: "2025-10-05T00:00:00.000Z"
 *               endDate:
 *                 type: string
 *                 format: date-time
 *                 example: "2025-11-05T00:00:00.000Z"
 *     responses:
 *       200:
 *         description: Post promoted successfully
 *       400:
 *         description: Invalid postId or parameters
 *       403:
 *         description: Not authorized to promote this post
 *       404:
 *         description: Post not found
 *       500:
 *         description: Server error
 */
router.post("/:postId/promote", authMiddleware, ...SecurityMiddleware.sensitiveOperations({ targetUserParam: 'postId' }), async (req, res) => {
  try {
    const postId = normalizeObjectId(req.params.postId);
    if (!postId) return res.status(400).json({ error: "Invalid postId format" });

    const userId = req.userId || req.user?.id || req.user?._id;
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ error: "Post not found" });

    // Only the owner can promote their post
    if (post.user.toString() !== String(userId)) {
      return res.status(403).json({ error: "Not authorized to promote this post" });
    }

    const { budget, target, startDate, endDate } = req.body;
    post.ad = post.ad || {};
    post.ad.isPromoted = true;
    if (budget !== undefined) post.ad.budget = Number(budget) || 0;
    if (typeof target === 'string') post.ad.target = target;
    if (startDate) post.ad.startDate = new Date(startDate);
    if (endDate) post.ad.endDate = new Date(endDate);

    await post.save();
    res.json({ success: true, post });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/posts/user/{userId}:
 *   get:
 *     summary: Get all posts by a user
 *     tags:
 *       - Posts
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         description: ID of the user whose posts to fetch
 *         schema:
 *           type: string
 *           pattern: '^[a-fA-F0-9]{24}$'
 *           example: '68cad398b391bdd7d991d5c7'
 *     responses:
 *       200:
 *         description: List of user's posts with privacy filtering applied
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 description: Post objects that the requesting user has permission to view
 *       400:
 *         description: Invalid userId format
 *       404:
 *         description: User not found or no posts
 *       500:
 *         description: Server error
 */
router.get("/user/:userId", authMiddleware, BlockingMiddleware.checkProfileAccess(), privacyFilterMiddleware.checkPostViewAccess(), async (req, res) => {
  try {
    const userId = normalizeObjectId(req.params.userId);
    if (!userId) return res.status(400).json({ error: "Invalid userId format" });
    
    const requestingUserId = req.userId || req.user?.id || req.user?._id;
    
    // Build privacy-aware query that includes user filter
    const baseQuery = { user: userId };
    
    // If requesting user is viewing their own posts, show all posts
    if (requestingUserId.toString() === userId.toString()) {
      const posts = await Post.find(baseQuery)
        .populate("user", "name email username profilePicture")
        .populate("privacy.selectedUsers", "name username")
        .sort({ createdAt: -1 });
      
      // Add engagement counts to response
      const postsWithCounts = posts.map(post => ({
        ...post.toObject(),
        likesCount: post.likes?.length || 0,
        commentsCount: post.comments?.length || 0
      }));
      
      return res.json(postsWithCounts);
    }
    
    // For other users' posts, apply privacy filtering
    const accessQuery = await privacyFilterMiddleware.buildAccessQuery(requestingUserId);
    
    // Combine user filter with privacy query
    const combinedQuery = {
      $and: [
        baseQuery,
        accessQuery
      ]
    };
    
    const posts = await Post.find(combinedQuery)
      .populate("user", "name email username profilePicture")
      .populate("privacy.selectedUsers", "name username")
      .sort({ createdAt: -1 });
    
    // Apply additional privacy filtering as a safety measure
    const filteredPosts = await privacyFilterMiddleware.filterPosts(posts, requestingUserId);
    
    // Add engagement counts to response
    const postsWithCounts = filteredPosts.map(post => ({
      ...post.toObject(),
      likesCount: post.likes?.length || 0,
      commentsCount: post.comments?.length || 0
    }));
    
    res.json(postsWithCounts);
  } catch (error) {
    console.error('User posts endpoint error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/posts/mixed:
 *   get:
 *     summary: Get mixed media posts (image or video)
 *     tags:
 *       - Posts
 *     responses:
 *       200:
 *         description: Mixed media posts retrieved successfully
 *       500:
 *         description: Error retrieving mixed posts
 */
router.get("/mixed", authMiddleware, async (req, res) => {
  try {
    const requestingUserId = req.userId || req.user?.id || req.user?._id;
    
    // Build privacy-aware query
    const accessQuery = await privacyFilterMiddleware.buildAccessQuery(requestingUserId);
    
    // Combine media filter with privacy query
    const combinedQuery = {
      $and: [
        { type: { $in: ["image", "video"] } },
        accessQuery
      ]
    };
    
    const posts = await Post.find(combinedQuery)
      .populate("user", "name email username profilePicture")
      .sort({ createdAt: -1 })
      .limit(50);
      
    // Apply blocking filter
    const BlockingService = (await import('../services/blockingService.js')).default;
    const filteredPosts = [];
    
    for (const post of posts) {
      const authorId = post.user._id || post.user;
      const canInteract = await BlockingService.enforceBlockingRules(requestingUserId, authorId);
      if (canInteract) {
        filteredPosts.push(post);
      }
    }
    
    res.json(filteredPosts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/posts/videos:
 *   get:
 *     summary: Get video-only feed with optional visual effect
 *     tags:
 *       - Posts
 *     parameters:
 *       - in: query
 *         name: effect
 *         schema:
 *           type: string
 *           enum: [grayscale, reverse, loop, accelerate]
 *         description: Optional Cloudinary visual effect to apply to returned video URLs
 *     responses:
 *       200:
 *         description: Video feed retrieved successfully
 *       500:
 *         description: Error retrieving video feed
 */
router.get("/videos", authMiddleware, async (req, res) => {
  try {
    const { effect } = req.query;
    const requestingUserId = req.userId || req.user?.id || req.user?._id;
    
    // Map friendly effect names to Cloudinary transformation strings
    const effectMap = {
      grayscale: 'e_grayscale',
      reverse: 'e_reverse',
      loop: 'e_loop:2',
      accelerate: 'e_accelerate:50',
    };
    const transformation = effectMap[effect] || null;

    // Build privacy-aware query
    const accessQuery = await privacyFilterMiddleware.buildAccessQuery(requestingUserId);
    
    // Combine video filter with privacy query
    const combinedQuery = {
      $and: [
        { type: "video" },
        accessQuery
      ]
    };

    const posts = await Post.find(combinedQuery)
      .populate("user", "name email username profilePicture")
      .sort({ createdAt: -1 })
      .limit(50);

    // Apply blocking filter
    const BlockingService = (await import('../services/blockingService.js')).default;
    const filteredPosts = [];
    
    for (const post of posts) {
      const authorId = post.user._id || post.user;
      const canInteract = await BlockingService.enforceBlockingRules(requestingUserId, authorId);
      if (canInteract) {
        filteredPosts.push(post);
      }
    }

    if (!transformation) {
      return res.json(filteredPosts);
    }

    // Apply transformation to media URLs on the fly
    const transformed = filteredPosts.map((p) => {
      const obj = p.toObject ? p.toObject() : { ...p };
      obj.media = transformCloudinaryUrl(obj.media, transformation);
      return obj;
    });

    res.json(transformed);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/posts/repost/{postId}:
 *   post:
 *     summary: Repost an existing post
 *     tags:
 *       - Posts
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         description: ID of the post to repost
 *         schema:
 *           type: string
 *           pattern: '^[a-fA-F0-9]{24}$'
 *           example: '68cad398b391bdd7d991d5c7'
 *     responses:
 *       201:
 *         description: Post reposted successfully
 *       400:
 *         description: Invalid postId format
 *       404:
 *         description: Post not found
 *       500:
 *         description: Server error
 */
// Repost another user's post (like retweet)
router.post("/repost/:postId", authMiddleware, ...SecurityMiddleware.postOperations(), async (req, res) => {
  try {
    const user = req.userId || req.user?.id || req.user?._id;
    const postId = normalizeObjectId(req.params.postId);
    if (!postId) return res.status(400).json({ error: "Invalid postId format" });
    const originalPost = await Post.findById(postId);
    if (!originalPost) return res.status(404).json({ error: "Post not found" });

    const newRepost = new Post({
      user,
      originalPost: originalPost._id,
      type: originalPost.type,
      text: originalPost.text || "",
      media: originalPost.media || ""
    });
    await newRepost.save();
    await newRepost.populate('user', 'name email username profilePicture');
    res.status(201).json({
      ...newRepost.toObject(),
      likesCount: newRepost.likes?.length || 0,
      commentsCount: newRepost.comments?.length || 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/posts/feed:
 *   get:
 *     summary: Get the feed of posts with privacy filtering
 *     description: Retrieves posts filtered based on the requesting user's permissions and relationships
 *     tags:
 *       - Posts
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Feed retrieved successfully with privacy filtering applied
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 description: Post objects that the user has permission to view
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Internal server error"
 */
router.get("/feed", authMiddleware, async (req, res) => {
    try {
        const requestingUserId = req.userId || req.user?.id || req.user?._id;
        
        // Build privacy-aware query for better performance
        const accessQuery = await privacyFilterMiddleware.buildAccessQuery(requestingUserId);
        
        const posts = await Post.find(accessQuery)
          .populate("user", "name email username profilePicture")
          .populate("privacy.selectedUsers", "name username")
          .sort({ createdAt: -1 })
          .limit(50);
        
        // Apply additional privacy filtering as a safety measure
        const privacyFilteredPosts = await privacyFilterMiddleware.filterPosts(posts, requestingUserId);
        
        // Apply blocking filtering to remove posts from blocked users
        const BlockingService = (await import('../services/blockingService.js')).default;
        const blockingFilteredPosts = [];
        
        for (const post of privacyFilteredPosts) {
          const authorId = post.user._id || post.user;
          const canInteract = await BlockingService.enforceBlockingRules(requestingUserId, authorId);
          if (canInteract) {
            blockingFilteredPosts.push(post);
          }
        }
        
        // Add engagement counts to response
        const postsWithCounts = blockingFilteredPosts.map(post => ({
            ...post.toObject(),
            likesCount: post.likes?.length || 0,
            commentsCount: post.comments?.length || 0
        }));
        
        res.json(postsWithCounts);
    } catch (error) {
        console.error('Feed endpoint error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/posts/like/{postId}:
 *   post:
 *     summary: Like or unlike a post (toggle)
 *     tags:
 *       - Posts
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         description: ID of the post to like/unlike
 *         schema:
 *           type: string
 *           pattern: '^[a-fA-F0-9]{24}$'
 *           example: '68cad398b391bdd7d991d5c7'
 *     responses:
 *       200:
 *         description: Post liked/unliked successfully
 *       400:
 *         description: Invalid postId format
 *       404:
 *         description: Post not found
 *       500:
 *         description: Server error
 */
// Like a post (Toggle like/unlike)
router.post("/like/:postId", authMiddleware, BlockingMiddleware.checkPostInteraction(), async (req, res) => {
  try {
    const user = req.userId || req.user?.id || req.user?._id;
    const postId = normalizeObjectId(req.params.postId);
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ error: "Post not found" });

    const userIdStr = user.toString();
    const index = post.likes.findIndex((u) => u.toString() === userIdStr);
    if (index === -1) {
      post.likes.push(user);
    } else {
      post.likes.splice(index, 1);
    }
    await post.save();

    // Update engagement totals (likes/comments)
    post.engagement = post.engagement || {};
    post.engagement.totalLikes = post.likes.length;
    post.engagement.totalComments = post.comments.length;
    await post.save();

    const populated = await Post.findById(post._id)
      .populate("user", "name email username profilePicture");

    res.json({
      ...populated.toObject(),
      likesCount: populated.likes?.length || 0,
      commentsCount: populated.comments?.length || 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Place dynamic postId route at the end to avoid capturing literal paths like /feed or /mixed
/**
 * @swagger
 * /api/posts/{postId}:
 *   get:
 *     summary: Get a single post by ID with privacy checking
 *     description: Retrieves a specific post if the requesting user has permission to view it based on privacy settings
 *     tags:
 *       - Posts
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         description: ID of the post to retrieve
 *         schema:
 *           type: string
 *           pattern: '^[a-fA-F0-9]{24}$'
 *           example: '68cad398b391bdd7d991d5c7'
 *     responses:
 *       200:
 *         description: Post retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               description: Post object with user and privacy information
 *       400:
 *         description: Invalid postId format
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Invalid postId format"
 *       403:
 *         description: User does not have permission to view this post
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "You don't have permission to view this post"
 *       404:
 *         description: Post not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Post not found"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Internal server error"
 */
router.get("/:postId", authMiddleware, async (req, res) => {
  try {
    const postId = normalizeObjectId(req.params.postId);
    if (!postId) return res.status(400).json({ error: "Invalid postId format" });
    
    const post = await Post.findById(postId)
      .populate("user", "name email username profilePicture")
      .populate("privacy.selectedUsers", "name username");
    
    if (!post) return res.status(404).json({ error: "Post not found" });
    
    const requestingUserId = req.userId || req.user?.id || req.user?._id;
    
    // Check if the requesting user can access this post
    const canAccess = await post.canUserAccess(requestingUserId);
    if (!canAccess) {
      return res.status(403).json({ 
        error: "You don't have permission to view this post" 
      });
    }
    
    // Add engagement counts to response
    const postWithCounts = {
      ...post.toObject(),
      likesCount: post.likes?.length || 0,
      commentsCount: post.comments?.length || 0
    };
    
    res.json(postWithCounts);
  } catch (error) {
    console.error('Single post endpoint error:', error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router; // ✅ Correct ES Module export