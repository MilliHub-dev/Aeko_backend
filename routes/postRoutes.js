import express from "express";
import { prisma } from "../config/db.js";
import { Prisma } from "@prisma/client";
import upload from "../middleware/upload.js";
import authMiddleware from "../middleware/authMiddleware.js";
import BlockingService from "../services/blockingService.js";

const router = express.Router();

// Helper to validate IDs
const isValidId = (id) => {
  return id && typeof id === 'string' && id.trim().length > 0;
};

// Helper to inject Cloudinary transformation into URLs
const transformCloudinaryUrl = (url, transformation) => {
  if (!url || typeof url !== 'string') return url;
  const marker = '/upload/';
  const idx = url.indexOf(marker);
  if (idx === -1 || !transformation) return url;
  if (url.slice(idx + marker.length).startsWith('e_')) return url;
  return url.slice(0, idx + marker.length) + transformation + '/' + url.slice(idx + marker.length);
};

// Helper to build privacy and blocking where clause
const getPrivacyWhereClause = async (requestingUserId) => {
    if (!requestingUserId) {
        return {
            OR: [
                { privacy: { path: ['level'], equals: 'public' } },
                { privacy: { equals: Prisma.JsonNull } }
            ]
        };
    }

    const user = await prisma.user.findUnique({ 
        where: { id: requestingUserId },
        select: { following: true, blockedUsers: true } 
    });
    
    const followingIds = Array.isArray(user?.following) ? user.following : [];
    
    // Get users I have blocked
    const blockedUserIds = (Array.isArray(user?.blockedUsers) ? user.blockedUsers : [])
        .map(b => b.user || b.userId || b.id || b);

    // We should exclude posts from users I blocked
    const notInBlocked = { userId: { notIn: blockedUserIds } };

    return {
        AND: [
            notInBlocked,
            {
                OR: [
                    { privacy: { path: ['level'], equals: 'public' } },
                    { privacy: { equals: Prisma.JsonNull } },
                    { userId: requestingUserId },
                    {
                        AND: [
                            { privacy: { path: ['level'], equals: 'select_users' } },
                            { privacy: { path: ['selectedUsers'], array_contains: requestingUserId } }
                        ]
                    },
                    {
                        AND: [
                            { privacy: { path: ['level'], equals: 'followers' } },
                            { userId: { in: followingIds } }
                        ]
                    }
                ]
            }
        ]
    };
};

// Bookmark a post
router.post("/:postId/bookmark", authMiddleware, async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.user.id || req.user._id;

        const post = await prisma.post.findUnique({ where: { id: postId } });
        if (!post) {
            return res.status(404).json({ message: "Post not found" });
        }

        const existingBookmark = await prisma.bookmark.findUnique({
            where: {
                userId_postId: {
                    userId: userId,
                    postId: postId
                }
            }
        });

        if (existingBookmark) {
            // Unbookmark
            await prisma.bookmark.delete({
                where: { id: existingBookmark.id }
            });
            
            const totalBookmarks = await prisma.bookmark.count({ where: { postId } });
            
            // Update post engagement
            const currentEngagement = post.engagement || {};
            await prisma.post.update({
                where: { id: postId },
                data: {
                    engagement: {
                        ...currentEngagement,
                        totalBookmarks
                    }
                }
            });

            return res.status(200).json({ 
                message: "Bookmark removed successfully", 
                bookmarked: false,
                totalBookmarks 
            });
        } else {
            // Bookmark
            await prisma.bookmark.create({
                data: {
                    userId,
                    postId
                }
            });

            const totalBookmarks = await prisma.bookmark.count({ where: { postId } });
            const currentEngagement = post.engagement || {};
            
            await prisma.post.update({
                where: { id: postId },
                data: {
                    engagement: {
                        ...currentEngagement,
                        totalBookmarks
                    }
                }
            });

            return res.status(200).json({ 
                message: "Post bookmarked successfully", 
                bookmarked: true,
                totalBookmarks
            });
        }

    } catch (error) {
        console.error("Bookmark Error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Get user bookmarks
router.get("/user/bookmarks", authMiddleware, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const userId = req.user.id || req.user._id;

        const [bookmarks, total] = await Promise.all([
            prisma.bookmark.findMany({
                where: { userId },
                skip,
                take: limit,
                orderBy: { savedAt: 'desc' },
                include: {
                    post: {
                        include: {
                            user: {
                                select: { username: true, name: true, profilePicture: true, blueTick: true, goldenTick: true }
                            }
                        }
                    }
                }
            }),
            prisma.bookmark.count({ where: { userId } })
        ]);

        const posts = bookmarks.map(b => b.post).filter(p => p);

        res.status(200).json({
            posts,
            pagination: {
                total,
                page,
                pages: Math.ceil(total / limit),
                limit
            }
        });

    } catch (error) {
        console.error("Get Bookmarks Error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Create Post
router.post("/create", authMiddleware, 
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
    const userId = req.userId || req.user?.id || req.user?._id;
    const { text = "", type: rawType, privacy = "public", selectedUsers: rawSelectedUsers } = req.body;

    let type = rawType;
    if (!type) {
      if (req.file?.mimetype?.startsWith('image/')) type = 'image';
      else if (req.file?.mimetype?.startsWith('video/')) type = 'video';
      else type = 'text';
    }

    if (!['text', 'image', 'video'].includes(type)) {
      return res.status(400).json({ error: "Invalid type. Must be one of: text, image, video" });
    }

    if ((type === 'image' || type === 'video') && !req.file) {
      return res.status(400).json({ error: "Media file is required for image/video posts" });
    }

    const validPrivacyLevels = ['public', 'followers', 'select_users', 'only_me'];
    if (!validPrivacyLevels.includes(privacy)) {
      return res.status(400).json({ error: "Invalid privacy level" });
    }

    let selectedUsers = [];
    if (privacy === 'select_users') {
      if (!rawSelectedUsers) return res.status(400).json({ error: "selectedUsers is required" });
      try {
        selectedUsers = JSON.parse(rawSelectedUsers);
        if (!Array.isArray(selectedUsers) || selectedUsers.length === 0) {
            return res.status(400).json({ error: "selectedUsers must be a non-empty array" });
        }
      } catch (e) {
        return res.status(400).json({ error: "selectedUsers must be a valid JSON array" });
      }
    }

    const mediaPath = req.file ? req.file.path : "";

    const postData = {
      userId,
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
          updatedBy: userId
        }]
      }
    };

    const newPost = await prisma.post.create({
        data: postData,
        include: {
            user: {
                select: { name: true, email: true, username: true, profilePicture: true }
            }
        }
    });
    
    // Process mentions in post text
    try {
        const { processMentions } = await import('../services/notificationService.js');
        await processMentions({
            text,
            senderId: userId,
            entityId: newPost.id,
            entityType: 'POST'
        });
    } catch (notifError) {
        console.error('Failed to process mentions:', notifError);
    }

    res.status(201).json({
      ...newPost,
      likesCount: 0,
      commentsCount: 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update Privacy
router.put("/:postId/privacy", authMiddleware, async (req, res) => {
  try {
    const { postId } = req.params;
    if (!isValidId(postId)) return res.status(400).json({ error: "Invalid postId format" });

    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) return res.status(404).json({ error: "Post not found" });

    const userId = req.userId || req.user?.id || req.user?._id;
    
    if (post.userId !== userId) {
      return res.status(403).json({ error: "Not authorized to update privacy for this post" });
    }

    const { privacy, selectedUsers = [] } = req.body;
    const validPrivacyLevels = ['public', 'followers', 'select_users', 'only_me'];
    if (!privacy || !validPrivacyLevels.includes(privacy)) {
      return res.status(400).json({ error: "Invalid privacy level" });
    }

    if (privacy === 'select_users' && (!Array.isArray(selectedUsers) || selectedUsers.length === 0)) {
        return res.status(400).json({ error: "selectedUsers is required" });
    }

    const currentPrivacy = post.privacy || {};
    const updateHistory = currentPrivacy.updateHistory || [];
    
    updateHistory.push({
        previousLevel: currentPrivacy.level,
        newLevel: privacy,
        updatedAt: new Date(),
        updatedBy: userId
    });

    const newPrivacy = {
        level: privacy,
        selectedUsers: privacy === 'select_users' ? selectedUsers : [],
        updatedAt: new Date(),
        updateHistory
    };

    const updatedPost = await prisma.post.update({
        where: { id: postId },
        data: { privacy: newPrivacy },
        include: {
            user: { select: { name: true, email: true, username: true, profilePicture: true } }
        }
    });

    res.json({
      success: true,
      message: "Privacy settings updated successfully",
      post: updatedPost
    });

  } catch (error) {
    console.error('Privacy update error:', error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Search posts
router.get("/search", authMiddleware, async (req, res) => {
    try {
        const { q, page = 1, limit = 20 } = req.query;
        if (!q) return res.status(400).json({ error: "Search query is required" });

        const requestingUserId = req.user.id || req.user._id;
        const privacyWhere = await getPrivacyWhereClause(requestingUserId);
        
        const posts = await prisma.post.findMany({
            where: {
                AND: [
                    { text: { contains: q, mode: 'insensitive' } },
                    privacyWhere
                ]
            },
            include: {
                user: { select: { name: true, email: true, username: true, profilePicture: true } },
                communities: { select: { id: true, name: true } }
            },
            orderBy: { createdAt: 'desc' },
            take: parseInt(limit),
            skip: (parseInt(page) - 1) * parseInt(limit)
        });

        res.json(posts);
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Feed
router.get("/feed", authMiddleware, async (req, res) => {
    try {
        const requestingUserId = req.user.id || req.user._id;
        const privacyWhere = await getPrivacyWhereClause(requestingUserId);
        
        // Get following IDs for prioritization
        const user = await prisma.user.findUnique({
            where: { id: requestingUserId },
            select: { following: true }
        });
        const followingIds = Array.isArray(user?.following) ? user.following : [];

        // 1. Get posts from followed users (Prioritized)
        const followedPosts = await prisma.post.findMany({
            where: {
                AND: [
                    privacyWhere,
                    { userId: { in: followingIds } }
                ]
            },
            include: {
                users_posts_userIdTouser: { select: { name: true, email: true, username: true, profilePicture: true } }
            },
            orderBy: { createdAt: 'desc' },
            take: 50
        });

        // 2. If we need more posts to fill the feed, get other visible posts
        let allPosts = [...followedPosts];
        if (allPosts.length < 50) {
            const remainingSlots = 50 - allPosts.length;
            const otherPosts = await prisma.post.findMany({
                where: {
                    AND: [
                        privacyWhere,
                        { userId: { notIn: followingIds } }
                    ]
                },
                include: {
                    users_posts_userIdTouser: { select: { name: true, email: true, username: true, profilePicture: true } }
                },
                orderBy: { createdAt: 'desc' },
                take: remainingSlots
            });
            allPosts = [...allPosts, ...otherPosts];
        }
        
        // Map relation back to 'user' for frontend compatibility
        const mappedPosts = allPosts.map(post => ({
            ...post,
            user: post.users_posts_userIdTouser,
            users_posts_userIdTouser: undefined
        }));
        
        res.json(mappedPosts);
    } catch (error) {
        console.error('Feed error:', error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Get single post
router.get("/:postId", authMiddleware, async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.userId || req.user?.id || req.user?._id;

        const post = await prisma.post.findUnique({
            where: { id: postId },
            include: {
                user: { select: { id: true, username: true, profilePicture: true } }
            }
        });
        
        if (!post) return res.status(404).json({ error: "Post not found" });

        // Check blocking
        const canInteract = await BlockingService.enforceBlockingRules(userId, post.userId);
        if (!canInteract) {
             return res.status(404).json({ error: "Post not found" }); // Hide existence
        }

        res.json(post);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Like/Unlike a post
router.post("/:postId/like", authMiddleware, async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.user.id || req.user._id;

        const post = await prisma.post.findUnique({ where: { id: postId } });
        if (!post) {
            return res.status(404).json({ message: "Post not found" });
        }

        // Check blocking
        const canInteract = await BlockingService.enforceBlockingRules(userId, post.userId);
        if (!canInteract) {
             return res.status(404).json({ error: "Post not found" });
        }

        let likes = Array.isArray(post.likes) ? post.likes : [];
        const isLiked = likes.includes(userId);
        
        if (isLiked) {
            // Unlike
            likes = likes.filter(id => id !== userId);
        } else {
            // Like
            likes.push(userId);
            
            // Create notification for like
            const { createNotification } = await import('../services/notificationService.js');
            // Get user info for notification message
            const user = await prisma.user.findUnique({ where: { id: userId }, select: { username: true, name: true } });
            
            await createNotification({
                recipientId: post.userId,
                senderId: userId,
                type: 'LIKE',
                title: 'New Like',
                message: `${user?.username || user?.name || 'Someone'} liked your post`,
                entityId: postId,
                entityType: 'POST',
                metadata: {
                    postImage: post.media?.[0]?.url // Include thumbnail if available
                }
            });
        }

        const totalLikes = likes.length;
        const currentEngagement = post.engagement || {};

        const updatedPost = await prisma.post.update({
            where: { id: postId },
            data: {
                likes: likes,
                engagement: {
                    ...currentEngagement,
                    totalLikes
                }
            }
        });

        return res.status(200).json({
            message: isLiked ? "Post unliked successfully" : "Post liked successfully",
            liked: !isLiked,
            totalLikes,
            post: updatedPost
        });

    } catch (error) {
        console.error("Like Post Error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Get reposts
router.get("/:postId/reposts", authMiddleware, async (req, res) => {
  try {
    const { postId } = req.params;
    const reposts = await prisma.post.findMany({
        where: { originalPostId: postId },
        include: {
            user: { select: { name: true, email: true, username: true, profilePicture: true } }
        },
        orderBy: { createdAt: 'desc' }
    });
    res.json(reposts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Share to status
router.post("/:postId/share-to-status", authMiddleware, async (req, res) => {
  try {
    const { postId } = req.params;
    const originalPost = await prisma.post.findUnique({ 
        where: { id: postId },
        include: { users_posts_userIdTouser: { select: { username: true, profilePicture: true, name: true } } }
    });
    if (!originalPost) return res.status(404).json({ error: "Post not found" });

    const userId = req.userId || req.user?.id || req.user?._id;
    // Basic access check (assuming public or owner for simplicity, or implement privacy check)
    // For now, allow sharing.

    const { additionalContent = '' } = req.body;
    
    // Map the awkward Prisma relation name to a cleaner object for storage
    const creator = originalPost.users_posts_userIdTouser || {};

    // Create status
    const sharedStatus = await prisma.status.create({
        data: {
            userId,
            type: 'shared_post',
            content: additionalContent,
            sharedPostId: postId,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
            originalContent: {
                creator: creator,
                post: originalPost
            }
        },
        include: {
            users: { select: { username: true, profilePicture: true } }
        }
    });

    res.status(201).json({
      success: true,
      message: "Post shared to status successfully",
      status: {
          ...sharedStatus,
          user: sharedStatus.users, // Map for frontend consistency
          users: undefined
      }
    });

  } catch (error) {
    console.error('Share to status error:', error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Promote post
router.post("/:postId/promote", authMiddleware, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id || req.user._id;
    
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) return res.status(404).json({ error: "Post not found" });

    if (post.userId !== userId) {
      return res.status(403).json({ error: "Not authorized to promote this post" });
    }

    const { budget, target, startDate, endDate } = req.body;
    
    const currentAd = post.ad || {};
    const newAd = {
        ...currentAd,
        isPromoted: true,
        budget: budget !== undefined ? Number(budget) : currentAd.budget,
        target: target || currentAd.target,
        startDate: startDate ? new Date(startDate) : currentAd.startDate,
        endDate: endDate ? new Date(endDate) : currentAd.endDate
    };

    const updatedPost = await prisma.post.update({
        where: { id: postId },
        data: { ad: newAd }
    });

    res.json({ success: true, post: updatedPost });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user posts
router.get("/user/:userId", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const requestingUserId = req.user.id || req.user._id;
    
    // Check blocking
    const canInteract = await BlockingService.enforceBlockingRules(requestingUserId, userId);
    if (!canInteract) {
         return res.status(404).json({ error: "User not found" }); // Hide existence
    }

    // Privacy check logic
    const privacyWhere = await getPrivacyWhereClause(requestingUserId);
    
    const where = {
        AND: [
            { userId: userId },
            privacyWhere
        ]
    };

    // If viewing own profile, skip privacy check (already covered by OR logic but to be safe/optimized)
    if (userId === requestingUserId) {
         // simplified query for own posts
         const posts = await prisma.post.findMany({
             where: { userId },
             include: {
                 user: { select: { name: true, email: true, username: true, profilePicture: true } }
             },
             orderBy: { createdAt: 'desc' }
         });
         return res.json(posts);
    }

    const posts = await prisma.post.findMany({
        where,
        include: {
            user: { select: { name: true, email: true, username: true, profilePicture: true } }
        },
        orderBy: { createdAt: 'desc' }
    });
    
    res.json(posts);
  } catch (error) {
    console.error('User posts endpoint error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get mixed media posts
router.get("/mixed", authMiddleware, async (req, res) => {
  try {
    const requestingUserId = req.user.id || req.user._id;
    const privacyWhere = await getPrivacyWhereClause(requestingUserId);
    
    const posts = await prisma.post.findMany({
        where: {
            AND: [
                { type: { in: ["image", "video"] } },
                privacyWhere
            ]
        },
        include: {
            user: { select: { name: true, email: true, username: true, profilePicture: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 50
    });
    
    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get videos
router.get("/videos", authMiddleware, async (req, res) => {
  try {
    const { effect } = req.query;
    const requestingUserId = req.user.id || req.user._id;
    
    const effectMap = {
      grayscale: 'e_grayscale',
      reverse: 'e_reverse',
      loop: 'e_loop:2',
      accelerate: 'e_accelerate:50',
    };
    const transformation = effectMap[effect] || null;

    const privacyWhere = await getPrivacyWhereClause(requestingUserId);

    const posts = await prisma.post.findMany({
        where: {
            AND: [
                { type: "video" },
                privacyWhere
            ]
        },
        include: {
            user: { select: { name: true, email: true, username: true, profilePicture: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 50
    });

    if (!transformation) {
      return res.json(posts);
    }

    const transformed = posts.map((p) => {
      const obj = { ...p };
      obj.media = transformCloudinaryUrl(obj.media, transformation);
      return obj;
    });

    res.json(transformed);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Repost
router.post("/repost/:postId", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { postId } = req.params;
    
    const originalPost = await prisma.post.findUnique({ where: { id: postId } });
    if (!originalPost) return res.status(404).json({ error: "Post not found" });

    const newRepost = await prisma.post.create({
        data: {
            userId,
            originalPostId: originalPost.id,
            type: originalPost.type,
            text: originalPost.text || "",
            media: originalPost.media || ""
        },
        include: {
            user: { select: { name: true, email: true, username: true, profilePicture: true } }
        }
    });

    res.status(201).json({
      ...newRepost,
      likesCount: 0,
      commentsCount: 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
