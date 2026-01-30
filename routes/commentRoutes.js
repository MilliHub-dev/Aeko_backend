import express from "express";
import { prisma } from "../config/db.js";
import authMiddleware from "../middleware/authMiddleware.js";
import BlockingMiddleware from "../middleware/blockingMiddleware.js";

const router = express.Router();

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
        userId: true,
        comments: true,
        likes: true,
        other_posts: true,
        engagement: true,
        media: true // For thumbnail
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
    const totalShares = post.other_posts ? post.other_posts.length : 0;
    
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

    // Process mentions in comment text
    try {
        const { processMentions } = await import('../services/notificationService.js');
        await processMentions({
            text,
            senderId: userId,
            entityId: newComment.id,
            entityType: 'COMMENT',
            postId: postId
        });
    } catch (notifError) {
        console.error('Failed to process mentions in comment:', notifError);
    }

    // Create notification for comment
    try {
      const { createNotification } = await import('../services/notificationService.js');
      // Get user info
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { username: true, name: true } });
      
      await createNotification({
          recipientId: post.userId,
          senderId: userId,
          type: 'COMMENT',
          title: 'New Comment',
          message: `${user?.username || 'Someone'} commented on your post`,
          entityId: newComment.id,
          entityType: 'COMMENT',
          metadata: { postId: post.id, commentId: newComment.id }
      });
    } catch (notifError) {
      console.error('Failed to create comment notification:', notifError);
    }

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
    console.error('Create comment error:', error);
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

        // Process mentions in reply text
        try {
            const { processMentions } = await import('../services/notificationService.js');
            await processMentions({
                text,
                senderId: userId,
                entityId: reply.id,
                entityType: 'COMMENT',
                postId: parentComment.postId
            });
        } catch (notifError) {
            console.error('Failed to process mentions in reply:', notifError);
        }

        // Create notification for reply
        const { createNotification } = await import('../services/notificationService.js');
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { username: true, name: true } });

        await createNotification({
            recipientId: parentComment.userId,
            senderId: userId,
            type: 'REPLY',
            title: 'New Reply',
            message: `${user?.username || user?.name || 'Someone'} replied to your comment`,
            entityId: parentComment.postId, // Link to post
            entityType: 'POST',
            metadata: {
                commentId: reply.id,
                parentCommentId: commentId,
                text: text.substring(0, 50)
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
            
            // Create notification for comment like
            const { createNotification } = await import('../services/notificationService.js');
            const user = await prisma.user.findUnique({ where: { id: userId }, select: { username: true, name: true } });

            await createNotification({
                recipientId: comment.userId,
                senderId: userId,
                type: 'LIKE_COMMENT',
                title: 'Comment Liked',
                message: `${user?.username || user?.name || 'Someone'} liked your comment`,
                entityId: comment.postId,
                entityType: 'POST',
                metadata: {
                    commentId: comment.id,
                    text: comment.text.substring(0, 50)
                }
            });

            return res.json({
                ...updatedComment,
                likesCount: likes.length,
                isLiked: true
            });
        }
        
        res.json({
            ...comment,
            likesCount: likes.length,
            isLiked: true
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get replies for a comment
router.get("/replies/:commentId", authMiddleware, async (req, res) => {
    try {
        const { commentId } = req.params;
        
        const replies = await prisma.comment.findMany({
            where: { parentId: commentId },
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
        });

        // Apply blocking filter
        const BlockingService = (await import('../services/blockingService.js')).default;
        const currentUserId = req.user?.id || req.user?._id;
        
        let finalReplies = replies;
        if (currentUserId) {
             const filtered = [];
             for (const reply of replies) {
                 const authorId = reply.user?.id || reply.userId;
                 if (authorId) {
                     const canInteract = await BlockingService.enforceBlockingRules(currentUserId, authorId);
                     if (canInteract) filtered.push(reply);
                 } else {
                     filtered.push(reply);
                 }
             }
             finalReplies = filtered;
        }

        // Add likes count and isLiked status
        const repliesWithCounts = finalReplies.map(reply => {
            const likes = Array.isArray(reply.likes) ? reply.likes : [];
            return {
                ...reply,
                likesCount: likes.length,
                isLiked: currentUserId ? likes.includes(currentUserId) : false
            };
        });

        res.json(repliesWithCounts);
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

        // Add likes count and isLiked status to comments and their replies
        const commentsWithCounts = finalComments.map(comment => {
            const likes = Array.isArray(comment.likes) ? comment.likes : [];
            
            // Process nested replies if they exist
            let processedReplies = [];
            if (comment.replies && Array.isArray(comment.replies)) {
                processedReplies = comment.replies.map(reply => {
                    const replyLikes = Array.isArray(reply.likes) ? reply.likes : [];
                    return {
                        ...reply,
                        likesCount: replyLikes.length,
                        isLiked: currentUserId ? replyLikes.includes(currentUserId) : false
                    };
                });
            }

            return {
                ...comment,
                replies: processedReplies,
                likesCount: likes.length,
                isLiked: currentUserId ? likes.includes(currentUserId) : false
            };
        });

        res.json(commentsWithCounts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
