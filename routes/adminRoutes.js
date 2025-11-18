import express from 'express';
import { adminAuth, superAdminAuth, adminLogin, adminLogout } from '../middleware/adminAuth.js';
import User from '../models/User.js';
import Post from '../models/Post.js';
import Ad from '../models/Ad.js';
import LiveStream from '../models/LiveStream.js';
import AekoTransaction from '../models/AekoTransaction.js';
import NFTMarketplace from '../models/NFTMarketplace.js';
import BotSettings from '../models/BotSettings.js';
import Debate from '../models/Debate.js';
import Challenge from '../models/Challenge.js';
import twoFactorMiddleware from '../middleware/twoFactorMiddleware.js';

const router = express.Router();

// ===== ADMIN AUTHENTICATION =====
router.post('/login', adminLogin);
router.post('/logout', adminAuth, adminLogout);

// ===== ADMIN DASHBOARD STATS =====
router.get('/stats', adminAuth, async (req, res) => {
  try {
    // User statistics
    const userStats = await User.aggregate([
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          verifiedUsers: { $sum: { $cond: [{ $or: ["$blueTick", "$goldenTick"] }, 1, 0] } },
          activeSubscriptions: { $sum: { $cond: [{ $eq: ["$subscriptionStatus", "active"] }, 1, 0] } },
          botEnabledUsers: { $sum: { $cond: ["$botEnabled", 1, 0] } },
          bannedUsers: { $sum: { $cond: ["$banned", 1, 0] } }
        }
      }
    ]);

    // Content statistics
    const postStats = await Post.aggregate([
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
          totalLikes: { $sum: { $size: "$likes" } },
          totalReposts: { $sum: { $size: "$reposts" } }
        }
      }
    ]);

    // Ad statistics
    const adStats = await Ad.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalBudget: { $sum: "$budget" }
        }
      }
    ]);

    // Stream statistics
    const streamStats = await LiveStream.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalViews: { $sum: "$totalViews" },
          totalRevenue: { $sum: "$monetization.totalEarnings" }
        }
      }
    ]);

    // Transaction statistics
    const transactionStats = await AekoTransaction.aggregate([
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
          totalFees: { $sum: "$platformFee" }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        users: userStats[0] || {},
        posts: postStats,
        ads: adStats,
        streams: streamStats,
        transactions: transactionStats
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch admin stats', error: error.message });
  }
});

// ===== USER MANAGEMENT =====
router.put('/users/:userId/ban', adminAuth, twoFactorMiddleware.requireTwoFactor(), async (req, res) => {
  try {
    const { reason } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { banned: true, banReason: reason },
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    res.json({ success: true, message: `User ${user.username} banned successfully`, user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to ban user', error: error.message });
  }
});

router.put('/users/:userId/unban', adminAuth, twoFactorMiddleware.requireTwoFactor(), async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { banned: false, $unset: { banReason: 1 } },
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    res.json({ success: true, message: `User ${user.username} unbanned successfully`, user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to unban user', error: error.message });
  }
});

router.put('/users/:userId/verify', adminAuth, twoFactorMiddleware.requireTwoFactor(), async (req, res) => {
  try {
    const { tickType } = req.body; // 'blue' or 'golden'
    const updateData = tickType === 'golden' ? { goldenTick: true } : { blueTick: true };
    
    const user = await User.findByIdAndUpdate(
      req.params.userId,
      updateData,
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    res.json({ success: true, message: `${tickType} tick granted to ${user.username}`, user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to verify user', error: error.message });
  }
});

// ===== CONTENT MODERATION =====
router.delete('/posts/:postId', adminAuth, twoFactorMiddleware.requireTwoFactor(), async (req, res) => {
  try {
    const post = await Post.findByIdAndDelete(req.params.postId);
    
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }
    
    res.json({ success: true, message: 'Post deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete post', error: error.message });
  }
});

router.put('/posts/:postId/flag', adminAuth, async (req, res) => {
  try {
    const { reason } = req.body;
    const post = await Post.findByIdAndUpdate(
      req.params.postId,
      { flagged: true, flagReason: reason },
      { new: true }
    );
    
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }
    
    res.json({ success: true, message: 'Post flagged successfully', post });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to flag post', error: error.message });
  }
});

// ===== LIVESTREAM MANAGEMENT =====
router.put('/streams/:streamId/end', adminAuth, async (req, res) => {
  try {
    const stream = await LiveStream.findByIdAndUpdate(
      req.params.streamId,
      { status: 'ended', endedAt: new Date() },
      { new: true }
    );
    
    if (!stream) {
      return res.status(404).json({ success: false, message: 'Stream not found' });
    }
    
    res.json({ success: true, message: `Stream "${stream.title}" ended successfully`, stream });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to end stream', error: error.message });
  }
});

router.put('/streams/:streamId/ban', adminAuth, async (req, res) => {
  try {
    const { reason } = req.body;
    const stream = await LiveStream.findByIdAndUpdate(
      req.params.streamId,
      { 
        status: 'ended', 
        endedAt: new Date(),
        banned: true,
        banReason: reason
      },
      { new: true }
    );
    
    if (!stream) {
      return res.status(404).json({ success: false, message: 'Stream not found' });
    }
    
    res.json({ success: true, message: `Stream "${stream.title}" banned and ended`, stream });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to ban stream', error: error.message });
  }
});

// ===== AD MANAGEMENT =====
router.put('/ads/:adId/approve', adminAuth, async (req, res) => {
  try {
    const ad = await Ad.findByIdAndUpdate(
      req.params.adId,
      { status: 'approved' },
      { new: true }
    );
    
    if (!ad) {
      return res.status(404).json({ success: false, message: 'Ad not found' });
    }
    
    res.json({ success: true, message: `Ad "${ad.title}" approved successfully`, ad });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to approve ad', error: error.message });
  }
});

router.put('/ads/:adId/reject', adminAuth, async (req, res) => {
  try {
    const { reason } = req.body;
    const ad = await Ad.findByIdAndUpdate(
      req.params.adId,
      { status: 'rejected', rejectionReason: reason },
      { new: true }
    );
    
    if (!ad) {
      return res.status(404).json({ success: false, message: 'Ad not found' });
    }
    
    res.json({ success: true, message: `Ad "${ad.title}" rejected`, ad });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to reject ad', error: error.message });
  }
});

// ===== DEBATE MANAGEMENT =====
router.put('/debates/:debateId/end', adminAuth, async (req, res) => {
  try {
    const { winner, reason } = req.body;
    const debate = await Debate.findByIdAndUpdate(
      req.params.debateId,
      { 
        status: 'ended',
        endedAt: new Date(),
        winner: winner,
        endReason: reason || 'Ended by admin'
      },
      { new: true }
    );
    
    if (!debate) {
      return res.status(404).json({ success: false, message: 'Debate not found' });
    }
    
    res.json({ success: true, message: `Debate "${debate.topic}" ended successfully`, debate });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to end debate', error: error.message });
  }
});

router.put('/debates/:debateId/moderate', adminAuth, async (req, res) => {
  try {
    const { action, reason } = req.body; // action: 'warn', 'suspend', 'end'
    const debate = await Debate.findByIdAndUpdate(
      req.params.debateId,
      { 
        moderationAction: action,
        moderationReason: reason,
        moderatedAt: new Date(),
        moderatedBy: req.user._id
      },
      { new: true }
    );
    
    if (!debate) {
      return res.status(404).json({ success: false, message: 'Debate not found' });
    }
    
    res.json({ success: true, message: `Debate moderated: ${action}`, debate });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to moderate debate', error: error.message });
  }
});

// ===== CHALLENGE MANAGEMENT =====
router.put('/challenges/:challengeId/end', adminAuth, async (req, res) => {
  try {
    const { winner, reason } = req.body;
    const challenge = await Challenge.findByIdAndUpdate(
      req.params.challengeId,
      { 
        status: 'ended',
        endedAt: new Date(),
        winner: winner,
        endReason: reason || 'Ended by admin'
      },
      { new: true }
    );
    
    if (!challenge) {
      return res.status(404).json({ success: false, message: 'Challenge not found' });
    }
    
    res.json({ success: true, message: 'Challenge ended successfully', challenge });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to end challenge', error: error.message });
  }
});

router.put('/challenges/:challengeId/moderate', adminAuth, async (req, res) => {
  try {
    const { action, reason } = req.body; // action: 'flag', 'remove', 'feature'
    const challenge = await Challenge.findByIdAndUpdate(
      req.params.challengeId,
      { 
        moderationAction: action,
        moderationReason: reason,
        moderatedAt: new Date(),
        moderatedBy: req.user._id
      },
      { new: true }
    );
    
    if (!challenge) {
      return res.status(404).json({ success: false, message: 'Challenge not found' });
    }
    
    res.json({ success: true, message: `Challenge moderated: ${action}`, challenge });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to moderate challenge', error: error.message });
  }
});

// ===== SYSTEM MANAGEMENT (Super Admin Only) =====
router.post('/system/backup', superAdminAuth, async (req, res) => {
  try {
    // Implementation for system backup
    res.json({ success: true, message: 'System backup initiated' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to initiate backup', error: error.message });
  }
});

router.get('/system/logs', superAdminAuth, async (req, res) => {
  try {
    // Implementation for system logs
    res.json({ success: true, logs: [] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch logs', error: error.message });
  }
});

// ===== ADMIN USER MANAGEMENT =====
router.post('/admins/create', superAdminAuth, twoFactorMiddleware.requireTwoFactor(), async (req, res) => {
  try {
    const { email, permissions } = req.body;
    const user = await User.findOneAndUpdate(
      { email },
      { 
        isAdmin: true,
        goldenTick: true, // Grant golden tick for admin privileges
        adminPermissions: permissions || ['read', 'moderate']
      },
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    res.json({ success: true, message: `Admin privileges granted to ${user.username}`, user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create admin', error: error.message });
  }
});

// Create first admin (no auth required - for initial setup)
router.post('/setup/first-admin', async (req, res) => {
  try {
    // Check if any admin exists
    const existingAdmin = await User.findOne({ isAdmin: true });
    if (existingAdmin) {
      return res.status(400).json({ 
        success: false, 
        message: 'Admin user already exists. Use regular admin creation endpoint.' 
      });
    }

    const { name, username, email, password } = req.body;
    
    // Validate required fields
    if (!name || !username || !email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'All fields (name, username, email, password) are required' 
      });
    }

    // Create first admin user
    const adminUser = new User({
      name,
      username,
      email,
      password, // Will be hashed by pre-save hook
      isAdmin: true,
      goldenTick: true,
      blueTick: true,
      subscriptionStatus: 'active',
      bio: 'Platform Administrator'
    });

    await adminUser.save();

    res.json({ 
      success: true, 
      message: 'First admin user created successfully',
      user: {
        id: adminUser._id,
        name: adminUser.name,
        username: adminUser.username,
        email: adminUser.email,
        isAdmin: adminUser.isAdmin
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create first admin', error: error.message });
  }
});

router.delete('/admins/:userId', superAdminAuth, twoFactorMiddleware.requireTwoFactor(), async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { 
        isAdmin: false,
        $unset: { adminPermissions: 1 }
      },
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    res.json({ success: true, message: `Admin privileges revoked from ${user.username}`, user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to revoke admin', error: error.message });
  }
});

export default router;
