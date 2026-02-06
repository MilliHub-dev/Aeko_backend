import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/db.js';
import authMiddleware from "../middleware/authMiddleware.js";
import BlockingMiddleware from "../middleware/blockingMiddleware.js";
import PrivacyManager from '../services/privacyManager.js';
import twoFactorMiddleware from "../middleware/twoFactorMiddleware.js";
import BlockingService from '../services/blockingService.js';

const router = express.Router();

/**
 * @swagger
 * /api/profile:
 *   get:
 *     summary: Get user profile
 *     tags:
 *       - Profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:  
 *         description: Server error
 * 
 * /api/profile/update:
 *   put:
 *     summary: Update user profile
 *     tags:
 *       - Profile 
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *               profilePic:
 *                 type: string
 *               bio:
 *                 type: string
 *           example:
 *             username: "newUsername"
 *             email: "newemail@example.com"
 *             profilePic: "https://res.cloudinary.com/demo/image/upload/v1/aeko/images/pic.jpg"
 *             bio: "Updated bio text"
 *     responses:
 *       200:
 *         description: User profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 * 
 * /api/profile/change-password:
 *   put:
 *     summary: Change user password
 *     tags:
 *       - Profile
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 * 
 * /api/profile/delete-account:
 *   delete:
 *     summary: Delete user account
 *     tags:
 *       - Profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User account deleted successfully
 *       401:
 *         description: Unauthorized
 * 
 * /api/profile/followers:
 *   get:
 *     summary: Get list of followers
 *     tags:
 *       - Profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of followers retrieved successfully
 * 
 * /api/profile/following:
 *   get:
 *     summary: Get list of users the current user is following
 *     tags:
 *       - Profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of following users retrieved successfully
 * 
 * /api/profile/follow/{userId}:
 *   put:
 *     summary: Follow a user
 *     tags:
 *       - Profile
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successfully followed the user
 * 
 * /api/profile/unfollow/{userId}:
 *   delete:
 *     summary: Unfollow a user
 *     tags:
 *       - Profile
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successfully unfollowed the user
 */

/**
 * /api/user/verify:
 *   post:
 *     summary: Verify user and get a Blue Tick
 *     tags:
 *       - Profile
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             properties:
 *               userId:
 *                 type: string
 *     responses:
 *       200:
 *         description: User verified with Blue Tick
 *
 * /api/user/subscribe:
 *   post:
 *     summary: Subscribe to Golden Tick
 *     tags:
 *       - Subscriptions
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *               paymentSuccess:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Golden Tick activated
 */

// ✅ Get Profile
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId || req.user?.id || req.user?._id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        _count: {
          select: { 
            posts_posts_userIdTousers: true, // Count posts
            bookmarks: true
          }
        }
      }
    });
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    // Remove password from response
    const { password, ...userWithoutPassword } = user;
    
    // Add flattened counts
    const enhancedUser = {
        ...userWithoutPassword,
        postsCount: user._count?.posts_posts_userIdTousers || 0,
        bookmarksCount: user._count?.bookmarks || 0,
        _count: undefined // Clean up
    };

    res.json({ success: true, user: enhancedUser });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/profile/activity:
 *   get:
 *     summary: Get user activity history (posts, comments, security events)
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *     responses:
 *       200:
 *         description: Activity history retrieved
 */
router.get('/activity', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id || req.user._id;
        const limit = parseInt(req.query.limit) || 20;
        const page = parseInt(req.query.page) || 1;
        const skip = (page - 1) * limit;

        // Fetch parallel data streams
        const [posts, comments, securityEvents] = await Promise.all([
            prisma.post.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                take: limit,
                select: { id: true, type: true, createdAt: true, text: true, media: true }
            }),
            prisma.comment.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                take: limit,
                select: { id: true, text: true, createdAt: true, postId: true }
            }),
            prisma.securityEvent.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                take: limit,
                select: { id: true, eventType: true, timestamp: true, ipAddress: true }
            })
        ]);

        // Normalize and combine
        const activities = [
            ...posts.map(p => ({
                type: 'POST_CREATED',
                id: p.id,
                title: 'Created a post',
                details: p.text || (p.media ? 'Media post' : 'Post'),
                timestamp: p.createdAt,
                metadata: { postType: p.type }
            })),
            ...comments.map(c => ({
                type: 'COMMENT_CREATED',
                id: c.id,
                title: 'Commented on a post',
                details: c.text,
                timestamp: c.createdAt,
                metadata: { postId: c.postId }
            })),
            ...securityEvents.map(e => ({
                type: 'SECURITY_EVENT',
                id: e.id,
                title: e.eventType,
                details: `IP: ${e.ipAddress}`,
                timestamp: e.timestamp,
                metadata: {}
            }))
        ];

        // Sort combined list by timestamp desc
        activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // Paginate the combined result (in-memory pagination for aggregated feed)
        // Note: For true scalability, we'd need a dedicated Activity Feed table, 
        // but this works for "My Activity" view.
        const paginatedActivities = activities.slice(skip, skip + limit);

        res.json({
            success: true,
            activities: paginatedActivities,
            pagination: {
                page,
                limit,
                hasMore: activities.length > skip + limit
            }
        });

    } catch (error) {
        console.error('Get activity error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch activity' });
    }
});

// ✅ Update Profile
router.put('/update', authMiddleware, twoFactorMiddleware.requireTwoFactor(), async (req, res) => {
  try {
    const userId = req.userId || req.user?.id || req.user?._id;
    const { username, email, profilePic, coverPic, bio, location } = req.body;
    
    const user = await prisma.user.update({
      where: { id: userId },
      data: { 
        username, 
        email, 
        profilePicture: profilePic, // Map profilePic to profilePicture
        coverPicture: coverPic, // Map coverPic to coverPicture
        bio,
        location
      }
    });
    
    // Remove password from response
    const { password, ...userWithoutPassword } = user;
    
    res.json({ success: true, user: userWithoutPassword });
  } catch (error) {
    if (error.code === 'P2025') {
        return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.status(500).json({ error: error.message });
  }
});

// ✅ Change Password
router.put('/change-password', authMiddleware, twoFactorMiddleware.requireTwoFactor(), async (req, res) => {
  try {
    const userId = req.userId || req.user?.id || req.user?._id;
    const { currentPassword, newPassword } = req.body;
    
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Verify current password
    // Note: Mongoose model had comparePassword method. With Prisma we use bcrypt directly.
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    
    if (!isMatch) return res.status(400).json({ error: 'Incorrect password' });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ Delete Account
router.delete('/delete-account', authMiddleware, twoFactorMiddleware.requireTwoFactor(), async (req, res) => {
  try {
    const userId = req.userId || req.user?.id || req.user?._id;
    await prisma.user.delete({
      where: { id: userId }
    });
    res.json({ success: true, message: 'User account deleted successfully' });
  } catch (error) {
    if (error.code === 'P2025') {
        // User already deleted or not found, which is technically a success for delete
        return res.json({ success: true, message: 'User account deleted successfully' });
    }
    res.status(500).json({ error: error.message });
  }
});

// ✅ List Followers - Updated with privacy controls
router.get('/followers', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId || req.user?.id || req.user?._id;
    
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { followers: true }
    });
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    const followerIds = Array.isArray(user.followers) ? user.followers : [];
    
    if (followerIds.length === 0) {
        return res.json({ success: true, followers: [] });
    }

    const followers = await prisma.user.findMany({
        where: { id: { in: followerIds } },
        select: { id: true, username: true, email: true, profilePicture: true }
    });
    
    // Filter followers based on privacy settings and blocking
    const filteredFollowers = [];
    for (const follower of followers) {
      // Check blocking
      const canInteract = await BlockingService.enforceBlockingRules(userId, follower.id);
      if (!canInteract) continue;

      // Check privacy (as per original logic)
      const canView = await PrivacyManager.canViewProfile(userId, follower.id);
      if (canView) {
        filteredFollowers.push(follower);
      }
    }
    
    res.json({ success: true, followers: filteredFollowers });
  } catch (error) {
    console.error('Get followers error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ List Following - Updated with privacy controls
router.get('/following', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId || req.user?.id || req.user?._id;
    
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { following: true }
    });
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    const followingIds = Array.isArray(user.following) ? user.following : [];
    
    if (followingIds.length === 0) {
        return res.json({ success: true, following: [] });
    }

    const followingUsers = await prisma.user.findMany({
        where: { id: { in: followingIds } },
        select: { id: true, username: true, email: true, profilePicture: true }
    });
    
    // Filter following list based on privacy settings
    const filteredFollowing = [];
    for (const followedUser of followingUsers) {
      // Check blocking
      const canInteract = await BlockingService.enforceBlockingRules(userId, followedUser.id);
      if (!canInteract) continue;

      const canView = await PrivacyManager.canViewProfile(userId, followedUser.id);
      if (canView) {
        filteredFollowing.push(followedUser);
      }
    }
    
    res.json({ success: true, following: filteredFollowing });
  } catch (error) {
    console.error('Get following error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ Search Followers
router.get('/followers/search', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId || req.user?.id || req.user?._id;
    const { query } = req.query;
    
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { followers: true }
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const followerIds = Array.isArray(user.followers) ? user.followers : [];

    if (followerIds.length === 0) {
        return res.json({ success: true, followers: [] });
    }

    const matchedFollowers = await prisma.user.findMany({
        where: {
            id: { in: followerIds },
            username: { contains: query, mode: 'insensitive' }
        },
        select: { id: true, username: true, email: true, profilePicture: true }
    });

    res.json({ success: true, followers: matchedFollowers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ Follow User - Updated with privacy controls
router.put('/follow/:id', authMiddleware, BlockingMiddleware.checkFollowAccess(), async (req, res) => {
  try {
    const userId = req.userId || req.user?.id || req.user?._id;
    const targetId = req.params.id;

    if (userId === targetId) {
        return res.status(400).json({ error: "You cannot follow yourself" });
    }
    
    // Check if user can interact with the target user
    const canView = await PrivacyManager.canViewProfile(userId, targetId);
    if (!canView) {
      return res.status(403).json({ error: 'You cannot follow this user due to privacy settings' });
    }

    const [user, targetUser] = await Promise.all([
        prisma.user.findUnique({ where: { id: userId }, select: { following: true } }),
        prisma.user.findUnique({ where: { id: targetId }, select: { followers: true } })
    ]);

    if (!user) return res.status(404).json({ error: 'Your account not found' });
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    const currentFollowing = Array.isArray(user.following) ? user.following : [];
    const currentFollowers = Array.isArray(targetUser.followers) ? targetUser.followers : [];

    // Check if already following
    if (currentFollowing.includes(targetId)) {
        return res.status(400).json({ error: "You are already following this user" });
    }

    // Add to following
    const updatedFollowing = [...currentFollowing, targetId];
    
    // Add to followers
    const updatedFollowers = [...currentFollowers, userId];

    await Promise.all([
        prisma.user.update({
            where: { id: userId },
            data: { following: updatedFollowing }
        }),
        prisma.user.update({
            where: { id: targetId },
            data: { followers: updatedFollowers }
        })
    ]);

    // TODO: Create notification for the target user
    const { createNotification } = await import('../services/notificationService.js');
    await createNotification({
        recipientId: targetId,
        senderId: userId,
        type: 'FOLLOW',
        title: 'New Follower',
        message: `${user.username || user.name || 'Someone'} started following you`,
        entityId: userId,
        entityType: 'USER'
    });

    res.json({ success: true, message: 'Followed user successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ Unfollow User - Updated with privacy controls
router.put('/unfollow/:id', authMiddleware, BlockingMiddleware.checkFollowAccess(), async (req, res) => {
  try {
    const userId = req.userId || req.user?.id || req.user?._id;
    const targetId = req.params.id;
    
    // Check if user can interact with the target user
    const canView = await PrivacyManager.canViewProfile(userId, targetId);
    if (!canView) {
      return res.status(403).json({ error: 'You cannot unfollow this user' });
    }

    const [user, unfollowUser] = await Promise.all([
        prisma.user.findUnique({ where: { id: userId }, select: { following: true } }),
        prisma.user.findUnique({ where: { id: targetId }, select: { followers: true } })
    ]);

    if (!user) return res.status(404).json({ error: 'Your account not found' });
    if (!unfollowUser) return res.status(404).json({ error: 'User not found' });

    const currentFollowing = Array.isArray(user.following) ? user.following : [];
    const currentFollowers = Array.isArray(unfollowUser.followers) ? unfollowUser.followers : [];

    // Remove from following
    const updatedFollowing = currentFollowing.filter(id => id.toString() !== targetId);
    
    // Remove from followers
    const updatedFollowers = currentFollowers.filter(id => id.toString() !== userId);

    await Promise.all([
        prisma.user.update({
            where: { id: userId },
            data: { following: updatedFollowing }
        }),
        prisma.user.update({
            where: { id: targetId },
            data: { followers: updatedFollowers }
        })
    ]);

    res.json({ success: true, message: 'Unfollowed user successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Verify user and give Blue Tick
router.post("/verify", authMiddleware, twoFactorMiddleware.requireTwoFactor(), async (req, res) => {
    const { userId, force } = req.body;
  
    try {
      // 1. Get verification settings
      let settings = await prisma.verificationSettings.findFirst();
      if (!settings) {
         settings = {
             minFollowers: 1000,
             minPosts: 10,
             requiresProfilePic: true,
             requiresCoverPic: true,
             requiresBio: true,
             autoApprove: true
         };
      }

      // 2. Get user with details
      const userToCheck = await prisma.user.findUnique({
          where: { id: userId },
          include: {
              _count: {
                  select: { posts_posts_userIdTousers: true } // Count posts
              }
          }
      });

      if (!userToCheck) {
          return res.status(404).json({ message: "User not found" });
      }

      // 3. Check conditions
      const followerCount = Array.isArray(userToCheck.followers) ? userToCheck.followers.length : 0;
      const postCount = userToCheck._count.posts_posts_userIdTousers;
      
      const errors = [];
      if (followerCount < settings.minFollowers) errors.push(`Not enough followers (Has: ${followerCount}, Required: ${settings.minFollowers})`);
      if (postCount < settings.minPosts) errors.push(`Not enough posts (Has: ${postCount}, Required: ${settings.minPosts})`);
      if (settings.requiresProfilePic && !userToCheck.profilePicture) errors.push("Missing profile picture");
      if (settings.requiresCoverPic && !userToCheck.coverPicture) errors.push("Missing cover picture");
      if (settings.requiresBio && !userToCheck.bio) errors.push("Missing bio");

      // 4. Enforce conditions unless forced
      if (errors.length > 0 && !force) {
          return res.status(400).json({ 
              message: "User does not meet verification criteria", 
              errors,
              canForce: true // Tell frontend it can be forced
          });
      }

      // 5. Update user
      const user = await prisma.user.update({
          where: { id: userId },
          data: { blueTick: true }
      });
  
      res.status(200).json({ 
          message: "User verified with Blue Tick ✅", 
          forced: errors.length > 0 
      });
    } catch (error) {
      if (error.code === 'P2025') {
        return res.status(404).json({ message: "User not found" });
      }
      res.status(500).json({ message: "Server error", error: error.message });
    }
  });

/**
 * @swagger
 * /api/profile/eligibility:
 *   get:
 *     summary: Check verification eligibility for current user
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Eligibility status
 */
router.get("/eligibility", authMiddleware, async (req, res) => {
    try {
        const userId = req.userId || req.user?.id || req.user?._id;

        // 1. Get verification settings
        let settings = await prisma.verificationSettings.findFirst();
        if (!settings) {
            settings = {
                minFollowers: 1000,
                minPosts: 10,
                requiresProfilePic: true,
                requiresCoverPic: true,
                requiresBio: true,
                autoApprove: true
            };
        }

        // 2. Get user with details
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                _count: {
                    select: { posts_posts_userIdTousers: true }
                }
            }
        });

        if (!user) return res.status(404).json({ error: "User not found" });

        // 3. Check conditions
        const followerCount = Array.isArray(user.followers) ? user.followers.length : 0;
        const postCount = user._count.posts_posts_userIdTousers;

        const criteria = {
            followers: { met: followerCount >= settings.minFollowers, current: followerCount, required: settings.minFollowers },
            posts: { met: postCount >= settings.minPosts, current: postCount, required: settings.minPosts },
            profilePicture: { met: !settings.requiresProfilePic || !!user.profilePicture, required: settings.requiresProfilePic },
            coverPicture: { met: !settings.requiresCoverPic || !!user.coverPicture, required: settings.requiresCoverPic },
            bio: { met: !settings.requiresBio || !!user.bio, required: settings.requiresBio }
        };

        const eligible = Object.values(criteria).every(c => c.met);

        res.json({ eligible, criteria });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
