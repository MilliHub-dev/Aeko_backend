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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               user:
 *                 type: string
 *                 description: User ID of the commenter
 *               text:
 *                 type: string
 *                 description: Comment text
 *             required:
 *               - user
 *               - text
 *     responses:
 *       201:
 *         description: Comment added successfully
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
 *     responses:
 *       200:
 *         description: List of comments for the post
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
 */



// Add a comment to a post
router.post("/:postId", async (req, res) => {
    try {
        const { user, text } = req.body;
        const post = await Post.findById(req.params.postId);
        if (!post) return res.status(404).json({ error: "Post not found" });

        const newComment = new Comment({ user, post: post._id, text });
        await newComment.save();

        post.comments.push(newComment._id);
        await post.save();

        res.status(201).json(newComment);
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
