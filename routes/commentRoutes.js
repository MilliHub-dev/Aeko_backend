import express from "express";
import Comment from "../models/Comment.js";
import Post from "../models/Post.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();
/**
 * @swagger
 * /api/comments/{postId}:
 *   post:
 *     summary: Add a comment to a post
 *     tags:
 *       - Comments
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         description: ID of the post to comment on
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
 *               text:
 *                 type: string
 *                 description: Comment text
 *             required:
 *               - text
 *     responses:
 *       201:
 *         description: Comment added successfully
 *       404:
 *         description: Post not found
 *       500:
 *         description: Server error
 *
 *   get:
 *     summary: Get comments for a post
 *     tags:
 *       - Comments
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         description: ID of the post to get comments for
 *         schema:
 *           type: string
 *           pattern: '^[a-fA-F0-9]{24}$'
 *           example: '68cad398b391bdd7d991d5c7'
 *     responses:
 *       200:
 *         description: List of comments for the post
 *       500:
 *         description: Server error
 *
 * /api/comments/like/{commentId}:
 *   post:
 *     summary: Like a comment
 *     tags:
 *       - Comments
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         description: ID of the comment to like
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
 *               user:
 *                 type: string
 *                 description: User ID of the liker
 *             required:
 *               - user
 *     responses:
 *       200:
 *         description: Comment liked successfully
 *       404:
 *         description: Comment not found
 *       500:
 *         description: Server error
 */



// Add a comment to a post
router.post("/:postId", authMiddleware, async (req, res) => {
  try {
    const { text } = req.body;
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ error: "Post not found" });

    const user = req.userId || req.body.user; // prefer auth, fallback for backward-compat
    if (!user) return res.status(400).json({ error: "User not provided" });

    const newComment = new Comment({ user, post: post._id, text });
    await newComment.save();

    post.comments.push(newComment._id);
    await post.save();

    // Update engagement counts on the post
    if (typeof post.updateEngagement === 'function') {
      await post.updateEngagement();
    } else {
      post.engagement = post.engagement || {};
      post.engagement.totalComments = post.comments.length;
      post.engagement.totalLikes = post.likes?.length || 0;
      post.engagement.totalShares = post.reposts?.length || 0;
      await post.save();
    }

    const populatedComment = await Comment.findById(newComment._id)
      .populate('user', 'name email username profilePicture');

    res.status(201).json({
      comment: populatedComment,
      postCounts: {
        totalComments: post.engagement.totalComments || 0,
        totalLikes: post.engagement.totalLikes || 0,
        totalShares: post.engagement.totalShares || 0,
        engagementRate: post.engagement.engagementRate || 0
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Like a comment
router.post("/like/:commentId", authMiddleware, async (req, res) => {
    try {
        const { user } = req.body;
        const comment = await Comment.findById(req.params.commentId);
        if (!comment) return res.status(404).json({ error: "Comment not found" });

        if (!comment.likes.includes(user)) {
            comment.likes.push(user);
            await comment.save();
        }
        res.json(comment);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get comments for a post
router.get("/:postId", authMiddleware, async (req, res) => {
    try {
        const comments = await Comment.find({ post: req.params.postId })
            .populate("user", "username profilePicture")
            .sort({ createdAt: -1 });

        res.json(comments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router; // ✅ ES Module export
