import express from "express";
import Post from "../models/Post.js";
import upload from "../middleware/upload.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * @swagger
 * /api/posts/create:
 *   post:
 *     summary: Create a new post
 *     description: Creates a new post with text, image, or video
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - text
 *               - type
 *             properties:
 *               text:
 *                 type: string
 *                 description: The text content of the post
 *               type:
 *                 type: string
 *                 description: The type of post (text, image, video)
 *               media:
 *                 type: string
 *                 description: URL of the media (optional, required for image/video types)
 *             example:
 *               text: "This is a sample post"
 *               type: "image"
 *               media: "http://example.com/image.jpg"
 *     responses:
 *       201:
 *         description: Post created successfully
 *       500:
 *         description: Error creating post
 * 
 * /api/posts/repost/{postId}:
 *   post:
 *     summary: Repost a post
 *     description: Reposts an existing post
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         description: ID of the post to repost
 *         schema:
 *           type: string
 *     responses:
 *       201:
 *         description: Post reposted successfully
 * 
 * /api/posts/feed:
 *   get:
 *     summary: Get video feed
 *     description: Retrieves the latest posts for the video feed
 *     responses:
 *       200:
 *         description: Video feed retrieved successfully
 * 
 * /api/posts/like/{postId}:
 *   post:
 *     summary: Like a post
 *     description: Likes or unlikes a post
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         description: ID of the post to like/unlike
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Post liked/unliked successfully
 * 
 * /api/posts/create_mixed:
 *   post:
 *     summary: Create a mixed media post
 *     description: Create a post with mixed media (images, videos, audio)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - mediaFiles
 *               - caption
 *             properties:
 *               mediaFiles:
 *                 type: array
 *                 description: List of media file URLs (images, videos, audio)
 *                 items:
 *                   type: string
 *               caption:
 *                 type: string
 *                 description: The caption for the post
 *             example:
 *               mediaFiles:
 *                 - "http://example.com/image1.jpg"
 *                 - "http://example.com/video1.mp4"
 *               caption: "Check out my new post!"
 *     responses:
 *       201:
 *         description: Mixed media post created successfully
 *       400:
 *         description: Bad request, invalid input
 *       500:
 *         description: Server error while creating post
 */



// Create a post (text, image, or video)
router.post("/create", authMiddleware, upload.single("media"), async (req, res) => {
    try {
        const { user, text, type } = req.body;
        const media = req.file ? req.file.path : null;

        const newPost = new Post({ user, text, media, type });
        await newPost.save();
        res.status(201).json(newPost);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Repost another user's post (like retweet)
router.post("/repost/:postId", authMiddleware, async (req, res) => {
    try {
        const { user } = req.body;
        const originalPost = await Post.findById(req.params.postId);
        if (!originalPost) return res.status(404).json({ error: "Post not found" });

        const newRepost = new Post({ user, originalPost: originalPost._id, type: originalPost.type });
        await newRepost.save();
        res.status(201).json(newRepost);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get video feed (Latest posts, TikTok-style scrolling)
router.get("/feed", authMiddleware, async (req, res) => {
    try {
        const posts = await Post.find().populate("user", "username profilePicture").sort({ createdAt: -1 }).limit(50);
        res.json(posts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Like a post (Toggle like/unlike)
router.post("/like/:postId", authMiddleware, async (req, res) => {
    try {
        const { user } = req.body;
        const post = await Post.findById(req.params.postId);
        if (!post) return res.status(404).json({ error: "Post not found" });

        const likeIndex = post.likes.indexOf(user);
        if (likeIndex === -1) {
            post.likes.push(user);
        } else {
            post.likes.splice(likeIndex, 1);
        }
        await post.save();

        res.json(post);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});




// Create a Mixed Media Post
router.post("/create_mixed", authMiddleware, upload.array("media"), async (req, res) => {
    try {
      const { text } = req.body;
      const files = req.files.map((file) => ({
        type: file.mimetype.startsWith("image/")
          ? "image"
          : file.mimetype.startsWith("video/")
          ? "video"
          : "audio",
        url: `/uploads/${file.filename}`, // Assuming files are stored in 'uploads' folder
      }));
  
      const post = new Post({
        text,
        media: files,
      });
  
      await post.save();
      res.status(201).json({ success: true, post });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

export default router; // ✅ Correct ES Module export
