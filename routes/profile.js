import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import authMiddleware from "../middleware/authMiddleware.js";
import BlockingMiddleware from "../middleware/blockingMiddleware.js";
import privacyFilterMiddleware from "../middleware/privacyMiddleware.js";
import PrivacyManager from '../services/privacyManager.js';
import twoFactorMiddleware from "../middleware/twoFactorMiddleware.js";

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

import bcrypt from 'bcrypt';

// Middleware for Authentication
/* const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.userId = decoded.userId;
    next();
  });
}; */

// ✅ Get Profile
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId || req.user?.id || req.user?._id;
    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ Update Profile
router.put('/update', authMiddleware, twoFactorMiddleware.requireTwoFactor(), async (req, res) => {
  try {
    const userId = req.userId || req.user?.id || req.user?._id;
    const { username, email, profilePic, bio } = req.body;
    const user = await User.findByIdAndUpdate(userId, { username, email, profilePic, bio }, { new: true });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ Change Password
router.put('/change-password', authMiddleware, twoFactorMiddleware.requireTwoFactor(), async (req, res) => {
  try {
    const userId = req.userId || req.user?.id || req.user?._id;
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) return res.status(400).json({ error: 'Incorrect password' });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ Delete Account
router.delete('/delete-account', authMiddleware, twoFactorMiddleware.requireTwoFactor(), async (req, res) => {
  try {
    const userId = req.userId || req.user?.id || req.user?._id;
    await User.findByIdAndDelete(userId);
    res.json({ success: true, message: 'User account deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ List Followers - Updated with privacy controls
router.get('/followers', authMiddleware, BlockingMiddleware.filterBlockedContent('followers', '_id'), async (req, res) => {
  try {
    const userId = req.userId || req.user?.id || req.user?._id;
    const user = await User.findById(userId).populate('followers', 'username email profilePicture');
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    // Filter followers based on privacy settings
    const filteredFollowers = [];
    for (const follower of user.followers) {
      const canView = await PrivacyManager.canViewProfile(userId, follower._id);
      if (canView) {
        filteredFollowers.push(follower);
      }
    }
    
    res.json({ success: true, followers: filteredFollowers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ List Following - Updated with privacy controls
router.get('/following', authMiddleware, BlockingMiddleware.filterBlockedContent('following', '_id'), async (req, res) => {
  try {
    const userId = req.userId || req.user?.id || req.user?._id;
    const user = await User.findById(userId).populate('following', 'username email profilePicture');
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    // Filter following list based on privacy settings
    const filteredFollowing = [];
    for (const followedUser of user.following) {
      const canView = await PrivacyManager.canViewProfile(userId, followedUser._id);
      if (canView) {
        filteredFollowing.push(followedUser);
      }
    }
    
    res.json({ success: true, following: filteredFollowing });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ Search Followers
router.get('/followers/search', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId || req.user?.id || req.user?._id;
    const { query } = req.query;
    const user = await User.findById(userId).populate({
      path: 'followers',
      match: { username: new RegExp(query, 'i') },
      select: 'username email profilePic'
    });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.json({ success: true, followers: user.followers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ Unfollow User - Updated with privacy controls
router.put('/unfollow/:id', authMiddleware, BlockingMiddleware.checkFollowAccess(), async (req, res) => {
  try {
    const userId = req.userId || req.user?.id || req.user?._id;
    
    // Check if user can interact with the target user
    const canView = await PrivacyManager.canViewProfile(userId, req.params.id);
    if (!canView) {
      return res.status(403).json({ error: 'You cannot unfollow this user' });
    }

    const user = await User.findById(userId);
    const unfollowUser = await User.findById(req.params.id);

    if (!user) return res.status(404).json({ error: 'Your account not found' });
    if (!unfollowUser) return res.status(404).json({ error: 'User not found' });

    user.following = user.following.filter(id => id.toString() !== req.params.id);
    unfollowUser.followers = unfollowUser.followers.filter(id => id.toString() !== userId);

    await user.save();
    await unfollowUser.save();

    res.json({ success: true, message: 'Unfollowed user successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Verify user and give Blue Tick
router.post("/verify", authMiddleware, twoFactorMiddleware.requireTwoFactor(), async (req, res) => {
    const { userId } = req.body;
  
    try {
      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
  
      user.blueTick = true;
      await user.save();
  
      res.status(200).json({ message: "User verified with Blue Tick ✅" });
    } catch (error) {
      res.status(500).json({ message: "Server error", error });
    }
  });

export default router;
