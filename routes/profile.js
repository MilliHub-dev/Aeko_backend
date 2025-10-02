import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import authMiddleware from "../middleware/authMiddleware.js";

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
    const user = await User.findById(req.userId).select('-password');
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ Update Profile
router.put('/update', authMiddleware, async (req, res) => {
  try {
    const { username, email, profilePic, bio } = req.body;
    const user = await User.findByIdAndUpdate(req.userId, { username, email, profilePic, bio }, { new: true });
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ Change Password
router.put('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.userId);
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
router.delete('/delete-account', authMiddleware, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.userId);
    res.json({ success: true, message: 'User account deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ List Followers
router.get('/followers', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate('followers', 'username email profilePic');
    res.json({ success: true, followers: user.followers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ List Following
router.get('/following', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate('following', 'username email profilePic');
    res.json({ success: true, following: user.following });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ Search Followers
router.get('/followers/search', authMiddleware, async (req, res) => {
  try {
    const { query } = req.query;
    const user = await User.findById(req.userId).populate({
      path: 'followers',
      match: { username: new RegExp(query, 'i') },
      select: 'username email profilePic'
    });
    res.json({ success: true, followers: user.followers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ Unfollow User
router.put('/unfollow/:id', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const unfollowUser = await User.findById(req.params.id);

    if (!unfollowUser) return res.status(404).json({ error: 'User not found' });

    user.following = user.following.filter(id => id.toString() !== req.params.id);
    unfollowUser.followers = unfollowUser.followers.filter(id => id.toString() !== req.userId);

    await user.save();
    await unfollowUser.save();

    res.json({ success: true, message: 'Unfollowed user successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Verify user and give Blue Tick
router.post("/verify", authMiddleware, async (req, res) => {
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
