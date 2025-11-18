import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidV4 } from "uuid";
import LiveStream from "../models/LiveStream.js";
import User from "../models/User.js";
import EnhancedMessage from "../models/EnhancedMessage.js";
import authMiddleware from "../middleware/authMiddleware.js";
import twoFactorMiddleware from "../middleware/twoFactorMiddleware.js";
import { uploadImage } from '../middleware/upload.js';

const router = express.Router();


// === STREAM MANAGEMENT ENDPOINTS ===

/**
 * @route   POST /api/livestream/create
 * @desc    Create a new livestream
 * @access  Private
 */
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      streamType,
      features,
      quality,
      tags,
      scheduledFor,
      monetization
    } = req.body;

    // Validate required fields
    if (!title || title.trim().length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Stream title is required' 
      });
    }

    const streamKey = uuidV4();
    const roomId = uuidV4();
    
    const streamData = {
      title: title.trim(),
      description: description?.trim() || '',
      category: category || 'other',
      streamType: streamType || 'public',
      host: req.user.id,
      hostName: req.user.username,
      hostProfilePicture: req.user.profilePicture,
      streamKey,
      roomId,
      features: {
        chatEnabled: features?.chatEnabled ?? true,
        reactionsEnabled: features?.reactionsEnabled ?? true,
        screenShareEnabled: features?.screenShareEnabled ?? false,
        recordingEnabled: features?.recordingEnabled ?? false,
        donationsEnabled: features?.donationsEnabled ?? false,
        subscribersOnly: features?.subscribersOnly ?? false,
        moderationEnabled: features?.moderationEnabled ?? true,
        ...features
      },
      quality: {
        resolution: quality?.resolution || '720p',
        bitrate: quality?.bitrate || 2500,
        fps: quality?.fps || 30,
        codec: quality?.codec || 'H.264',
        ...quality
      },
      tags: Array.isArray(tags) ? tags.slice(0, 10) : [],
      scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
      monetization: {
        ticketPrice: monetization?.ticketPrice || 0,
        currency: monetization?.currency || 'USD',
        totalEarnings: 0,
        donations: [],
        subscribers: [],
        ...monetization
      },
      metadata: {
        streamProtocol: 'WebRTC'
      }
    };

    const liveStream = new LiveStream(streamData);
    await liveStream.save();

    // Generate streaming URLs
    const streamUrls = {
      rtmp: `rtmp://localhost:1935/live/${streamKey}`,
      webrtc: `ws://localhost:5000/webrtc/${roomId}`,
      hls: `http://localhost:8080/hls/${streamKey}/index.m3u8`
    };

    res.status(201).json({
      success: true,
      message: 'Stream created successfully',
      data: {
        streamId: liveStream._id,
        streamKey,
        roomId,
        urls: streamUrls,
        stream: liveStream
      }
    });
  } catch (error) {
    console.error('Create stream error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create stream',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/livestream/:streamId/start
 * @desc    Start a livestream
 * @access  Private
 */
router.post('/:streamId/start', authMiddleware, async (req, res) => {
  try {
    const { streamId } = req.params;

    const liveStream = await LiveStream.findById(streamId);
    if (!liveStream) {
      return res.status(404).json({
        success: false,
        message: 'Stream not found'
      });
    }

    if (liveStream.host.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to start this stream'
      });
    }

    if (liveStream.status === 'live') {
      return res.status(400).json({
        success: false,
        message: 'Stream is already live'
      });
    }

    await liveStream.startStream();

    res.json({
      success: true,
      message: 'Stream started successfully',
      data: {
        streamId: liveStream._id,
        status: liveStream.status,
        startedAt: liveStream.startedAt
      }
    });
  } catch (error) {
    console.error('Start stream error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start stream',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/livestream/:streamId/end
 * @desc    End a livestream
 * @access  Private
 */
router.post('/:streamId/end', authMiddleware, async (req, res) => {
  try {
    const { streamId } = req.params;

    const liveStream = await LiveStream.findById(streamId);
    if (!liveStream) {
      return res.status(404).json({
        success: false,
        message: 'Stream not found'
      });
    }

    if (liveStream.host.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to end this stream'
      });
    }

    await liveStream.endStream();

    res.json({
      success: true,
      message: 'Stream ended successfully',
      data: {
        streamId: liveStream._id,
        status: liveStream.status,
        endedAt: liveStream.endedAt,
        duration: liveStream.duration,
        totalViews: liveStream.totalViews,
        peakViewers: liveStream.peakViewers
      }
    });
  } catch (error) {
    console.error('End stream error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to end stream',
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/livestream/:streamId
 * @desc    Update stream settings
 * @access  Private
 */
router.put('/:streamId', authMiddleware, async (req, res) => {
  try {
    const { streamId } = req.params;
    const updates = req.body;

    const liveStream = await LiveStream.findById(streamId);
    if (!liveStream) {
      return res.status(404).json({
        success: false,
        message: 'Stream not found'
      });
    }

    if (liveStream.host.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this stream'
      });
    }

    // Update allowed fields
    const allowedUpdates = [
      'title', 'description', 'category', 'tags', 'features', 
      'quality', 'monetization', 'mature'
    ];
    
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        if (field === 'features' || field === 'quality' || field === 'monetization') {
          liveStream[field] = { ...liveStream[field], ...updates[field] };
        } else {
          liveStream[field] = updates[field];
        }
      }
    });

    await liveStream.save();

    res.json({
      success: true,
      message: 'Stream updated successfully',
      data: liveStream
    });
  } catch (error) {
    console.error('Update stream error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update stream',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/livestream/:streamId/thumbnail
 * @desc    Upload stream thumbnail
 * @access  Private
 */
router.post('/:streamId/thumbnail', authMiddleware, uploadImage.single('thumbnail'), async (req, res) => {
  try {
    const { streamId } = req.params;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No thumbnail file provided'
      });
    }

    const liveStream = await LiveStream.findById(streamId);
    if (!liveStream) {
      return res.status(404).json({
        success: false,
        message: 'Stream not found'
      });
    }

    if (liveStream.host.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this stream'
      });
    }

    // Delete old thumbnail if exists
    if (liveStream.thumbnail) {
      const oldThumbnailPath = path.join(process.cwd(), liveStream.thumbnail);
      if (fs.existsSync(oldThumbnailPath)) {
        fs.unlinkSync(oldThumbnailPath);
      }
    }

    liveStream.thumbnail = req.file.path; // Cloudinary URL
    await liveStream.save();

    res.json({
      success: true,
      message: 'Thumbnail uploaded successfully',
      data: {
        thumbnail: liveStream.thumbnail
      }
    });
  } catch (error) {
    console.error('Upload thumbnail error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload thumbnail',
      error: error.message
    });
  }
});

// === DISCOVERY ENDPOINTS ===

/**
 * @route   GET /api/livestream/trending
 * @desc    Get trending live streams
 * @access  Public
 */
router.get('/trending', async (req, res) => {
  try {
    const { limit = 10, category } = req.query;
    
    let query = { status: 'live', streamType: 'public' };
    if (category && category !== 'all') {
      query.category = category;
    }

    const streams = await LiveStream.find(query)
      .sort({ currentViewers: -1, totalViews: -1 })
      .limit(parseInt(limit))
      .populate('host', 'username profilePicture verified followers')
      .select('-streamKey -rtmpUrl -hlsUrl -webrtcUrl');

    res.json({
      success: true,
      data: streams
    });
  } catch (error) {
    console.error('Get trending streams error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get trending streams',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/livestream/category/:category
 * @desc    Get streams by category
 * @access  Public
 */
router.get('/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const { limit = 20, page = 1 } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const streams = await LiveStream.find({ 
      status: 'live', 
      category,
      streamType: 'public' 
    })
      .sort({ currentViewers: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('host', 'username profilePicture verified')
      .select('-streamKey -rtmpUrl -hlsUrl -webrtcUrl');

    const total = await LiveStream.countDocuments({ 
      status: 'live', 
      category,
      streamType: 'public' 
    });

    res.json({
      success: true,
      data: {
        streams,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get category streams error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get category streams',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/livestream/search
 * @desc    Search live streams
 * @access  Public
 */
router.get('/search', async (req, res) => {
  try {
    const { q: query, category, language, limit = 20, page = 1 } = req.query;
    
    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const searchQuery = {
      status: 'live',
      streamType: 'public',
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
        { tags: { $in: [new RegExp(query, 'i')] } },
        { hostName: { $regex: query, $options: 'i' } }
      ]
    };

    if (category && category !== 'all') {
      searchQuery.category = category;
    }
    
    if (language && language !== 'all') {
      searchQuery.language = language;
    }

    const streams = await LiveStream.find(searchQuery)
      .sort({ currentViewers: -1, totalViews: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('host', 'username profilePicture verified')
      .select('-streamKey -rtmpUrl -hlsUrl -webrtcUrl');

    const total = await LiveStream.countDocuments(searchQuery);

    res.json({
      success: true,
      data: {
        query,
        streams,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Search streams error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search streams',
      error: error.message
    });
  }
});

// === UTILITY ENDPOINTS ===

/**
 * @route   GET /api/livestream/categories
 * @desc    Get available stream categories
 * @access  Public
 */
router.get('/categories', (req, res) => {
  const categories = [
    { value: 'gaming', label: 'Gaming', icon: '🎮' },
    { value: 'music', label: 'Music', icon: '🎵' },
    { value: 'education', label: 'Education', icon: '📚' },
    { value: 'entertainment', label: 'Entertainment', icon: '🎭' },
    { value: 'sports', label: 'Sports', icon: '⚽' },
    { value: 'news', label: 'News', icon: '📰' },
    { value: 'technology', label: 'Technology', icon: '💻' },
    { value: 'lifestyle', label: 'Lifestyle', icon: '🏠' },
    { value: 'cooking', label: 'Cooking', icon: '👨‍🍳' },
    { value: 'art', label: 'Art', icon: '🎨' },
    { value: 'other', label: 'Other', icon: '🔖' }
  ];

  res.json({
    success: true,
    data: categories
  });
});

/**
 * @route   GET /api/livestream/stats
 * @desc    Get platform livestream statistics
 * @access  Public
 */
router.get('/stats', async (req, res) => {
  try {
    const [
      totalStreams,
      liveStreams,
      totalStreamers,
      totalViews
    ] = await Promise.all([
      LiveStream.countDocuments(),
      LiveStream.countDocuments({ status: 'live' }),
      LiveStream.distinct('host').countDocuments(),
      LiveStream.aggregate([
        { $group: { _id: null, total: { $sum: '$totalViews' } } }
      ])
    ]);

    const stats = {
      totalStreams,
      liveStreams,
      totalStreamers,
      totalViews: totalViews[0]?.total || 0,
      timestamp: new Date()
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get platform stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get platform statistics',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/livestream/:streamId
 * @desc    Get stream details
 * @access  Public
 */
router.get('/:streamId', async (req, res) => {
  try {
    const { streamId } = req.params;

    const liveStream = await LiveStream.findById(streamId)
      .populate('host', 'username profilePicture verified followers createdAt')
      .populate('moderation.moderators', 'username profilePicture')
      .select('-streamKey');

    if (!liveStream) {
      return res.status(404).json({
        success: false,
        message: 'Stream not found'
      });
    }

    // Hide private URLs for non-hosts
    if (req.user?.id !== liveStream.host._id.toString()) {
      liveStream.rtmpUrl = undefined;
      liveStream.hlsUrl = undefined;
      liveStream.webrtcUrl = undefined;
    }

    res.json({
      success: true,
      data: liveStream
    });
  } catch (error) {
    console.error('Get stream details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get stream details',
      error: error.message
    });
  }
});

// === USER STREAM MANAGEMENT ===

/**
 * @route   GET /api/livestream/user/streams
 * @desc    Get user's streams
 * @access  Private
 */
router.get('/user/streams', authMiddleware, async (req, res) => {
  try {
    const { status = 'all', limit = 10, page = 1 } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    let query = { host: req.user.id };
    if (status !== 'all') {
      query.status = status;
    }

    const streams = await LiveStream.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('host', 'username profilePicture verified');

    const total = await LiveStream.countDocuments(query);

    res.json({
      success: true,
      data: {
        streams,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get user streams error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user streams',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/livestream/user/analytics/:streamId
 * @desc    Get stream analytics
 * @access  Private
 */
router.get('/user/analytics/:streamId', authMiddleware, async (req, res) => {
  try {
    const { streamId } = req.params;

    const liveStream = await LiveStream.findById(streamId);
    if (!liveStream) {
      return res.status(404).json({
        success: false,
        message: 'Stream not found'
      });
    }

    if (liveStream.host.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view analytics'
      });
    }

    // Get chat messages for this stream
    const chatMessages = await EnhancedMessage.find({
      chatId: streamId,
      'metadata.streamChat': true
    }).countDocuments();

    // Calculate engagement metrics
    const engagementData = {
      totalViews: liveStream.totalViews,
      uniqueViewers: liveStream.uniqueViewers.length,
      peakViewers: liveStream.peakViewers,
      currentViewers: liveStream.currentViewers,
      averageWatchTime: liveStream.analytics.averageWatchTime,
      chatMessages: chatMessages,
      reactions: liveStream.reactions.length,
      likes: liveStream.likes,
      shares: liveStream.analytics.shares,
      engagementRate: liveStream.engagementRate,
      donations: liveStream.monetization.donations.length,
      totalEarnings: liveStream.monetization.totalEarnings,
      deviceStats: liveStream.analytics.deviceStats,
      topCountries: liveStream.analytics.topCountries,
      duration: liveStream.duration,
      durationFormatted: liveStream.durationFormatted
    };

    res.json({
      success: true,
      data: engagementData
    });
  } catch (error) {
    console.error('Get stream analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get stream analytics',
      error: error.message
    });
  }
});

// === MODERATION ENDPOINTS ===

/**
 * @route   POST /api/livestream/:streamId/moderators
 * @desc    Add moderator to stream
 * @access  Private
 */
router.post('/:streamId/moderators', authMiddleware, async (req, res) => {
  try {
    const { streamId } = req.params;
    const { userId } = req.body;

    const liveStream = await LiveStream.findById(streamId);
    if (!liveStream) {
      return res.status(404).json({
        success: false,
        message: 'Stream not found'
      });
    }

    if (liveStream.host.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Only the host can add moderators'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    await liveStream.addModerator(userId);

    res.json({
      success: true,
      message: 'Moderator added successfully',
      data: {
        moderator: {
          userId: user._id,
          username: user.username,
          profilePicture: user.profilePicture
        }
      }
    });
  } catch (error) {
    console.error('Add moderator error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add moderator',
      error: error.message
    });
  }
});

/**
 * @route   DELETE /api/livestream/:streamId/moderators/:userId
 * @desc    Remove moderator from stream
 * @access  Private
 */
router.delete('/:streamId/moderators/:userId', authMiddleware, async (req, res) => {
  try {
    const { streamId, userId } = req.params;

    const liveStream = await LiveStream.findById(streamId);
    if (!liveStream) {
      return res.status(404).json({
        success: false,
        message: 'Stream not found'
      });
    }

    if (liveStream.host.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Only the host can remove moderators'
      });
    }

    liveStream.moderation.moderators = liveStream.moderation.moderators.filter(
      mod => mod.toString() !== userId
    );
    await liveStream.save();

    res.json({
      success: true,
      message: 'Moderator removed successfully'
    });
  } catch (error) {
    console.error('Remove moderator error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove moderator',
      error: error.message
    });
  }
});

// === MONETIZATION ENDPOINTS ===

/**
 * @route   POST /api/livestream/:streamId/donate
 * @desc    Process donation to stream
 * @access  Private
 */
router.post('/:streamId/donate', authMiddleware, twoFactorMiddleware.requireTwoFactor(), async (req, res) => {
  try {
    const { streamId } = req.params;
    const { amount, message, currency = 'USD' } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid donation amount is required'
      });
    }

    const liveStream = await LiveStream.findById(streamId);
    if (!liveStream) {
      return res.status(404).json({
        success: false,
        message: 'Stream not found'
      });
    }

    if (!liveStream.features.donationsEnabled) {
      return res.status(400).json({
        success: false,
        message: 'Donations are disabled for this stream'
      });
    }

    // Here you would integrate with your payment processor
    // For now, we'll simulate a successful payment

    const donation = {
      userId: req.user.id,
      amount: parseFloat(amount),
      message: message || '',
      timestamp: new Date()
    };

    liveStream.monetization.donations.push(donation);
    liveStream.monetization.totalEarnings += parseFloat(amount);
    await liveStream.save();

    res.json({
      success: true,
      message: 'Donation processed successfully',
      data: {
        donation: {
          ...donation,
          donorUsername: req.user.username
        }
      }
    });
  } catch (error) {
    console.error('Process donation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process donation',
      error: error.message
    });
  }
});

// === ERROR HANDLING ===
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 100MB.'
      });
    }
  }
  
  console.error('Livestream route error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: error.message
  });
});

export default router;

/**
 * @swagger
 * /api/livestream/create:
 *   post:
 *     summary: Create a new livestream
 *     tags: [Livestream]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               category:
 *                 type: string
 *               streamType:
 *                 type: string
 *               features:
 *                 type: object
 *               quality:
 *                 type: object
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               scheduledFor:
 *                 type: string
 *                 format: date-time
 *               monetization:
 *                 type: object
 *     responses:
 *       201:
 *         description: Stream created successfully
 *       400:
 *         description: Stream title is required
 */

/**
 * @swagger
 * /api/livestream/{streamId}/start:
 *   post:
 *     summary: Start a livestream
 *     tags: [Livestream]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: streamId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Stream started successfully
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Stream not found
 */

/**
 * @swagger
 * /api/livestream/{streamId}/end:
 *   post:
 *     summary: End a livestream
 *     tags: [Livestream]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: streamId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Stream ended successfully
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Stream not found
 */

/**
 * @swagger
 * /api/livestream/{streamId}/thumbnail:
 *   post:
 *     summary: Upload a stream thumbnail
 *     tags: [Livestream]
 *     security:
 *       - bearerAuth: []
 *     consumes:
 *       - multipart/form-data
 *     parameters:
 *       - in: path
 *         name: streamId
 *         required: true
 *         schema:
 *           type: string
 *       - in: formData
 *         name: thumbnail
 *         required: true
 *         type: file
 *     responses:
 *       200:
 *         description: Thumbnail uploaded successfully
 *       400:
 *         description: No thumbnail file provided
 */

/**
 * @swagger
 * /api/livestream/trending:
 *   get:
 *     summary: Get trending livestreams
 *     tags: [Discovery]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Trending streams retrieved successfully
 */

