import express from "express";
import mongoose from "mongoose";
import Post from "../models/Post.js";
import upload from "../middleware/upload.js";
import authMiddleware from "../middleware/authMiddleware.js";

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
 *     description: Creates a new post with text, image, or video
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
 *               media:
 *                 type: string
 *                 format: binary
 *                 description: Media file for image/video posts (required if inferred or specified type is 'image' or 'video')
 *           encoding:
 *             media:
 *               contentType: [image/*, video/*]
 *           examples:
 *             textPost:
 *               summary: Create a text-only post
 *               value:
 *                 text: "Hello Aeko!"
 *             imagePost:
 *               summary: Create an image post
 *               value:
 *                 type: image
 *                 text: "My picture"
 *             videoPost:
 *               summary: Create a video post
 *               value:
 *                 type: video
 *                 text: "My video"
 *     responses:
 *       201:
 *         description: Post created successfully
 *       400:
 *         description: Bad request
 *       500:
 *         description: Server error
 */
// Create a new post (text/image/video)
router.post("/create", authMiddleware, upload.single("media"), async (req, res) => {
  try {
    const user = req.userId;
    const { text = "", type: rawType } = req.body;

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

    const mediaPath = req.file ? req.file.path : ""; // Cloudinary storage exposes URL in file.path

    const newPost = new Post({ user, type, text, media: mediaPath });
    await newPost.save();
    res.status(201).json(newPost);
  } catch (error) {
    res.status(500).json({ error: error.message });
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
    const reposts = await Post.find({ originalPost: postId }).populate("user", "username profilePicture").sort({ createdAt: -1 });
    res.json(reposts);
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
 *         description: List of user's posts
 *       400:
 *         description: Invalid userId format
 *       404:
 *         description: User not found or no posts
 *       500:
 *         description: Server error
 */
router.get("/user/:userId", authMiddleware, async (req, res) => {
  try {
    const userId = normalizeObjectId(req.params.userId);
    if (!userId) return res.status(400).json({ error: "Invalid userId format" });
    const posts = await Post.find({ user: userId })
      .populate("user", "username profilePicture")
      .sort({ createdAt: -1 });
    res.json(posts);
  } catch (error) {
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
    const posts = await Post.find({ type: { $in: ["image", "video"] } })
      .populate("user", "username profilePicture")
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(posts);
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
    // Map friendly effect names to Cloudinary transformation strings
    const effectMap = {
      grayscale: 'e_grayscale',
      reverse: 'e_reverse',
      loop: 'e_loop:2',
      accelerate: 'e_accelerate:50',
    };
    const transformation = effectMap[effect] || null;

    const posts = await Post.find({ type: "video" })
      .populate("user", "username profilePicture")
      .sort({ createdAt: -1 })
      .limit(50);

    if (!transformation) {
      return res.json(posts);
    }

    // Apply transformation to media URLs on the fly
    const transformed = posts.map((p) => {
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
router.post("/repost/:postId", authMiddleware, async (req, res) => {
  try {
    const user = req.userId;
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
    res.status(201).json(newRepost);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/posts/feed:
 *   get:
 *     summary: Get the feed of posts
 *     tags:
 *       - Posts
 *     responses:
 *       200:
 *         description: Feed retrieved successfully
 *       500:
 *         description: Server error
 */
router.get("/feed", authMiddleware, async (req, res) => {
    try {
        const posts = await Post.find().populate("user", "username profilePicture").sort({ createdAt: -1 }).limit(50);
        res.json(posts);
    } catch (error) {
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
router.post("/like/:postId", authMiddleware, async (req, res) => {
  try {
    const user = req.userId;
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

    res.json(post);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Place dynamic postId route at the end to avoid capturing literal paths like /feed or /mixed
router.get("/:postId", authMiddleware, async (req, res) => {
  try {
    const postId = normalizeObjectId(req.params.postId);
    if (!postId) return res.status(400).json({ error: "Invalid postId format" });
    const post = await Post.findById(postId).populate("user", "username profilePicture");
    if (!post) return res.status(404).json({ error: "Post not found" });
    res.json(post);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router; // ✅ Correct ES Module export
