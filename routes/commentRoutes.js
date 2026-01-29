import express from "express";
import { PrismaClient } from '@prisma/client';
import authMiddleware from "../middleware/authMiddleware.js";
import BlockingMiddleware from "../middleware/blockingMiddleware.js";

const router = express.Router();
const prisma = new PrismaClient();

// Add a comment to a post
router.post("/:postId", authMiddleware, BlockingMiddleware.checkPostInteraction(), async (req, res) => {
  try {
    const { text } = req.body;
    const postId = req.params.postId;
    
    // Fetch post to verify it exists and get engagement data
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        comments: true,
        likes: true,
        reposts: true,
        engagement: true
      }
    });

    if (!post) return res.status(404).json({ error: "Post not found" });

    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    // Create comment
    const newComment = await prisma.comment.create({
      data: {
        text,
        postId,
        userId,
        likes: [] // Initialize empty likes
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            username: true,
            profilePicture: true
          }
        }
      }
    });

    // Calculate new stats
    const totalComments = (post.comments ? post.comments.length : 0) + 1; // +1 for the new one (though create already adds it, count might lag if not refreshed)
    // Actually better to use Prisma count or just increment
    // Since we didn't fetch all comments, we can rely on existing count from engagement or just update it.
    
    // Update post engagement
    const engagement = post.engagement || {};
    const totalLikes = Array.isArray(post.likes) ? post.likes.length : 0;
    const totalShares = post.reposts ? post.reposts.length : 0;
    
    // We'll update the engagement JSON
    await prisma.post.update({
      where: { id: postId },
      data: {
        engagement: {
          ...engagement,
          totalComments: totalComments, // Approximate increment
          totalLikes,
          totalShares
        }
      }
    });

    res.status(201).json({
      comment: newComment,
      postCounts: {
        totalComments: totalComments,
        totalLikes: totalLikes,
        totalShares: totalShares,
        engagementRate: engagement.engagementRate || 0
      }
    });
  } catch (error) {
    console.error("Error creating comment:", error);
    res.status(500).json({ error: error.message });
  }
});

// Add a reply to a comment
router.post("/reply/:commentId", authMiddleware, BlockingMiddleware.checkPostInteraction(), async (req, res) => {
    try {
        const { text } = req.body;
        const commentId = req.params.commentId;
        const userId = req.userId;

        // Verify parent comment exists
        const parentComment = await prisma.comment.findUnique({
            where: { id: commentId }
        });

        if (!parentComment) return res.status(404).json({ error: "Comment not found" });

        // Create reply
        const reply = await prisma.comment.create({
            data: {
                text,
                postId: parentComment.postId,
                userId,
                parentId: commentId,
                likes: []
            },
            include: {
                user: {
                    select: {
                        name: true,
                        email: true,
                        username: true,
                        profilePicture: true
                    }
                }
            }
        });

        // Update post engagement (optional, but good for total comment count)
        // ... (similar to add comment logic if needed)

        res.status(201).json(reply);
    } catch (error) {
        console.error("Error creating reply:", error);
        res.status(500).json({ error: error.message });
    }
});

// Like a comment
router.post("/like/:commentId", authMiddleware, BlockingMiddleware.checkPostInteraction(), async (req, res) => {
    try {
        const userId = req.userId;
        const commentId = req.params.commentId;

        const comment = await prisma.comment.findUnique({
            where: { id: commentId },
            include: { user: true }
        });

        if (!comment) return res.status(404).json({ error: "Comment not found" });

        // Check if user can interact with comment author
        const currentUserId = userId;
        const commentAuthorId = comment.userId;
        
        if (currentUserId && commentAuthorId) {
            const BlockingService = (await import('../services/blockingService.js')).default;
            const canInteract = await BlockingService.enforceBlockingRules(currentUserId, commentAuthorId);
            
            if (!canInteract) {
                return res.status(403).json({
                    error: 'Cannot interact with comment due to blocking relationship'
                });
            }
        }

        // Check if already liked
        let likes = Array.isArray(comment.likes) ? comment.likes : [];
        if (!likes.includes(userId)) {
            likes.push(userId);
            
            const updatedComment = await prisma.comment.update({
                where: { id: commentId },
                data: { likes: likes }
            });
            return res.json(updatedComment);
        }
        
        res.json(comment);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get comments for a post
router.get("/:postId", authMiddleware, async (req, res) => {
    try {
        const comments = await prisma.comment.findMany({
            where: { 
                postId: req.params.postId,
                parentId: null // Only fetch top-level comments
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        username: true,
                        profilePicture: true
                    }
                },
                replies: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                username: true,
                                profilePicture: true
                            }
                        }
                    },
                    orderBy: { createdAt: 'asc' }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        const BlockingService = (await import('../services/blockingService.js')).default;
        const currentUserId = req.user?.id || req.user?._id;
        
        let finalComments = comments;
        if (currentUserId) {
             const filtered = [];
             for (const comment of comments) {
                 const authorId = comment.user?.id || comment.userId;
                 if (authorId) {
                     const canInteract = await BlockingService.enforceBlockingRules(currentUserId, authorId);
                     if (canInteract) filtered.push(comment);
                 } else {
                     filtered.push(comment);
                 }
             }
             finalComments = filtered;
        }

        res.json(finalComments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
