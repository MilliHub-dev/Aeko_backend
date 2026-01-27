import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidV4 } from "uuid";
import { prisma } from "../config/db.js";
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
    
    // Create a Chat for the stream first
    const chat = await prisma.chat.create({
      data: {
        isGroup: true,
        groupName: `${title} Chat`,
        isCommunityChat: false
      }
    });

    const streamData = {
      title: title.trim(),
      description: description?.trim() || '',
      category: category || 'other',
      streamType: streamType || 'public',
      host: { connect: { id: req.user.id } },
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
        moderation: {
            moderators: [],
            bannedUsers: []
        },
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
      },
      chat: { connect: { id: chat.id } }
    };

    const liveStream = await prisma.liveStream.create({
      data: streamData
    });

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
        streamId: liveStream.id,
        _id: liveStream.id, // Backward compatibility
        streamKey,
        roomId,
        urls: streamUrls,
        stream: { ...liveStream, _id: liveStream.id }
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

    const liveStream = await prisma.liveStream.findUnique({
      where: { id: streamId }
    });
    
    if (!liveStream) {
      return res.status(404).json({
        success: false,
        message: 'Stream not found'
      });
    }

    if (liveStream.hostId !== req.user.id) {
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

    const updatedStream = await prisma.liveStream.update({
        where: { id: streamId },
        data: {
            status: 'live',
            startedAt: new Date()
        }
    });

    res.json({
      success: true,
      message: 'Stream started successfully',
      data: {
        streamId: updatedStream.id,
        _id: updatedStream.id,
        status: updatedStream.status,
        startedAt: updatedStream.startedAt
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

    const liveStream = await prisma.liveStream.findUnique({
      where: { id: streamId }
    });

    if (!liveStream) {
      return res.status(404).json({
        success: false,
        message: 'Stream not found'
      });
    }

    if (liveStream.hostId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to end this stream'
      });
    }

    const endedAt = new Date();
    let duration = 0;
    if (liveStream.startedAt) {
        duration = Math.floor((endedAt.getTime() - new Date(liveStream.startedAt).getTime()) / 1000);
    }

    const updatedStream = await prisma.liveStream.update({
        where: { id: streamId },
        data: {
            status: 'ended',
            endedAt: endedAt,
            duration: duration
        }
    });

    res.json({
      success: true,
      message: 'Stream ended successfully',
      data: {
        streamId: updatedStream.id,
        _id: updatedStream.id,
        status: updatedStream.status,
        endedAt: updatedStream.endedAt,
        duration: updatedStream.duration,
        totalViews: updatedStream.totalViews,
        peakViewers: updatedStream.peakViewers
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

    const liveStream = await prisma.liveStream.findUnique({
        where: { id: streamId }
    });

    if (!liveStream) {
      return res.status(404).json({
        success: false,
        message: 'Stream not found'
      });
    }

    if (liveStream.hostId !== req.user.id) {
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
    
    const updateData = {};
    
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        if (field === 'features' || field === 'quality' || field === 'monetization') {
          // Merge JSON fields
          updateData[field] = { ...(liveStream[field] || {}), ...updates[field] };
        } else {
          updateData[field] = updates[field];
        }
      }
    });

    const updatedStream = await prisma.liveStream.update({
        where: { id: streamId },
        data: updateData
    });

    res.json({
      success: true,
      message: 'Stream updated successfully',
      data: { ...updatedStream, _id: updatedStream.id }
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

    const liveStream = await prisma.liveStream.findUnique({
        where: { id: streamId }
    });

    if (!liveStream) {
      return res.status(404).json({
        success: false,
        message: 'Stream not found'
      });
    }

    if (liveStream.hostId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this stream'
      });
    }

    // Delete old thumbnail if exists (optional logic, skipping fs delete for safety unless strictly needed)
    // If local file:
    if (liveStream.thumbnail && !liveStream.thumbnail.startsWith('http')) {
      const oldThumbnailPath = path.join(process.cwd(), liveStream.thumbnail);
      if (fs.existsSync(oldThumbnailPath)) {
        try {
            fs.unlinkSync(oldThumbnailPath);
        } catch(e) { console.error("Error deleting old thumbnail", e)}
      }
    }

    const updatedStream = await prisma.liveStream.update({
        where: { id: streamId },
        data: { thumbnail: req.file.path } // Cloudinary URL or local path
    });

    res.json({
      success: true,
      message: 'Thumbnail uploaded successfully',
      data: {
        thumbnail: updatedStream.thumbnail
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
    
    let whereClause = { status: 'live', streamType: 'public' };
    if (category && category !== 'all') {
      whereClause.category = category;
    }

    const streams = await prisma.liveStream.findMany({
        where: whereClause,
        orderBy: [
            { currentViewers: 'desc' },
            { totalViews: 'desc' }
        ],
        take: parseInt(limit),
        include: {
            host: {
                select: {
                    username: true,
                    profilePicture: true,
                    blueTick: true,
                    // followers: true // Followers is JSON, might be heavy. Skip unless needed.
                }
            }
        }
    });

    // Remove sensitive keys manually
    const sanitizedStreams = streams.map(s => {
        const { streamKey, rtmpUrl, hlsUrl, webrtcUrl, ...rest } = s;
        return { 
            ...rest, 
            _id: s.id,
            host: {
                ...s.host,
                _id: s.hostId,
                verified: s.host.blueTick // backward compat
            }
        };
    });

    res.json({
      success: true,
      data: sanitizedStreams
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
    
    const whereClause = { 
      status: 'live', 
      category,
      streamType: 'public' 
    };

    const streams = await prisma.liveStream.findMany({
        where: whereClause,
        orderBy: { currentViewers: 'desc' },
        skip: skip,
        take: parseInt(limit),
        include: {
            host: {
                select: {
                    username: true,
                    profilePicture: true,
                    blueTick: true
                }
            }
        }
    });

    const total = await prisma.liveStream.count({ where: whereClause });

    const sanitizedStreams = streams.map(s => {
        const { streamKey, rtmpUrl, hlsUrl, webrtcUrl, ...rest } = s;
        return { 
            ...rest, 
            _id: s.id,
            host: {
                ...s.host,
                _id: s.hostId,
                verified: s.host.blueTick
            }
        };
    });

    res.json({
      success: true,
      data: {
        streams: sanitizedStreams,
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
    
    const whereClause = {
      status: 'live',
      streamType: 'public',
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        { hostName: { contains: query, mode: 'insensitive' } },
        // tags search in Prisma is tricky if tags is String[] array (Postgres). 
        // If it's MongoDB-like array in Postgres, 'has' might work or need raw query.
        // Assuming String[] array in Postgres:
        { tags: { has: query } } 
      ]
    };

    if (category && category !== 'all') {
      whereClause.category = category;
    }
    
    // language is not a top-level field in Schema? Let's check. 
    // Schema says `language: { type: String, default: "en" }` in Mongoose.
    // In Prisma schema... I don't recall seeing 'language'.
    // Checked schema: LiveStream does NOT have 'language' field in Prisma. It has 'tags', 'metadata', etc.
    // So skipping language filter for now or check if it's in metadata.
    
    const streams = await prisma.liveStream.findMany({
        where: whereClause,
        orderBy: [
            { currentViewers: 'desc' },
            { totalViews: 'desc' }
        ],
        skip: skip,
        take: parseInt(limit),
        include: {
            host: {
                select: {
                    username: true,
                    profilePicture: true,
                    blueTick: true
                }
            }
        }
    });

    const total = await prisma.liveStream.count({ where: whereClause });

    const sanitizedStreams = streams.map(s => {
        const { streamKey, rtmpUrl, hlsUrl, webrtcUrl, ...rest } = s;
        return { 
            ...rest, 
            _id: s.id,
            host: {
                ...s.host,
                _id: s.hostId,
                verified: s.host.blueTick
            }
        };
    });

    res.json({
      success: true,
      data: {
        query,
        streams: sanitizedStreams,
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
    const totalStreams = await prisma.liveStream.count();
    const liveStreams = await prisma.liveStream.count({ where: { status: 'live' } });
    
    // Distinct host count
    const distinctHosts = await prisma.liveStream.groupBy({
        by: ['hostId'],
    });
    const totalStreamers = distinctHosts.length;

    const totalViewsAgg = await prisma.liveStream.aggregate({
        _sum: {
            totalViews: true
        }
    });

    const stats = {
      totalStreams,
      liveStreams,
      totalStreamers,
      totalViews: totalViewsAgg._sum.totalViews || 0,
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

    const liveStream = await prisma.liveStream.findUnique({
        where: { id: streamId },
        include: {
            host: {
                select: {
                    username: true,
                    profilePicture: true,
                    blueTick: true,
                    createdAt: true,
                    // followers: true // Too heavy
                }
            }
        }
    });

    if (!liveStream) {
      return res.status(404).json({
        success: false,
        message: 'Stream not found'
      });
    }

    // Hide private URLs for non-hosts
    // Need to handle user authentication check properly here.
    // req.user might be undefined if public route.
    // authMiddleware is NOT on this route?
    // Route definition says: router.get('/:streamId', ...) - NO authMiddleware.
    // But inside it checks req.user?.id
    
    // We need to check if we can verify token optionally.
    // Usually standard express apps might have a user populate middleware or we rely on client sending header.
    // But since it's public, we assume req.user is undefined unless we parse it.
    
    // Assuming a middleware populates req.user if token present, or we can't check owner.
    // We'll proceed with hiding.
    
    const isHost = req.user?.id === liveStream.hostId;

    const sanitizedStream = { ...liveStream, _id: liveStream.id };
    
    if (!isHost) {
      sanitizedStream.rtmpUrl = undefined;
      sanitizedStream.hlsUrl = undefined;
      sanitizedStream.webrtcUrl = undefined;
      sanitizedStream.streamKey = undefined;
    }
    
    // Transform host for frontend compatibility
    sanitizedStream.host = {
        ...liveStream.host,
        _id: liveStream.hostId,
        verified: liveStream.host.blueTick
    };

    // Moderator details are in 'features.moderation' or 'moderation' field in Mongo.
    // In Prisma schema, I added 'moderation' as JSON? No, I don't see 'moderation' in Prisma LiveStream model explicitly.
    // Wait, let's re-read Schema.
    // LiveStream model: quality Json?, features Json?, monetization Json?, metadata Json?.
    // It DOES NOT have 'moderation' field. It seems moderation is inside 'features' based on my POST /create logic above.
    // Or maybe I missed it.
    // Mongoose schema has `moderation` object.
    // In Prisma migration, if I put it in `features`, I should read it from there.
    
    // If frontend expects `moderation.moderators` populated with user details... we have a problem.
    // JSON fields don't support population.
    // We might need to fetch moderator users manually if they are stored as IDs in JSON.
    
    // Let's check where moderation is stored. In create, I put it in `features.moderation`.
    // If it contains user IDs, we need to fetch them.
    
    if (sanitizedStream.features?.moderation?.moderators?.length > 0) {
        const moderatorIds = sanitizedStream.features.moderation.moderators;
        const moderators = await prisma.user.findMany({
            where: { id: { in: moderatorIds } },
            select: { id: true, username: true, profilePicture: true }
        });
        
        // attach populated moderators
        sanitizedStream.moderation = {
            ...sanitizedStream.features.moderation,
            moderators: moderators.map(m => ({...m, _id: m.id}))
        };
    }

    res.json({
      success: true,
      data: sanitizedStream
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
    
    let whereClause = { hostId: req.user.id };
    if (status !== 'all') {
      whereClause.status = status;
    }

    const streams = await prisma.liveStream.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip: skip,
        take: parseInt(limit),
        include: {
            host: {
                select: {
                    username: true,
                    profilePicture: true,
                    blueTick: true
                }
            }
        }
    });

    const total = await prisma.liveStream.count({ where: whereClause });

    const sanitizedStreams = streams.map(s => ({
        ...s,
        _id: s.id,
        host: { ...s.host, _id: s.hostId, verified: s.host.blueTick }
    }));

    res.json({
      success: true,
      data: {
        streams: sanitizedStreams,
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

    const liveStream = await prisma.liveStream.findUnique({
        where: { id: streamId }
    });

    if (!liveStream) {
      return res.status(404).json({
        success: false,
        message: 'Stream not found'
      });
    }

    if (liveStream.hostId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view analytics'
      });
    }

    // Get chat messages for this stream
    // Using EnhancedMessage with chatId
    // Need to find chat associated with stream first
    // liveStream.chatId is available in Prisma schema
    
    let chatMessagesCount = 0;
    if (liveStream.chatId) {
        chatMessagesCount = await prisma.enhancedMessage.count({
            where: {
                chatId: liveStream.chatId,
                // metadata: { path: ['streamChat'], equals: true } // JSON filtering in Prisma is DB specific.
                // Simplified: just count messages in the stream chat
            }
        });
    }

    // Calculate engagement metrics
    // Safely access JSON fields
    const analytics = liveStream.metadata?.analytics || {}; // Or whereever it is stored
    // In Mongoose schema, 'analytics' is a top-level field. In Prisma schema, it is NOT.
    // It must be in metadata or features.
    // Checking schema again...
    // Prisma schema: LiveStream has: metadata Json?, features Json?. NO analytics field.
    // So we should assume analytics data is in metadata or just return basic stats.
    
    const uniqueViewersCount = Array.isArray(liveStream.uniqueViewers) ? liveStream.uniqueViewers.length : 0;
    const reactionsCount = Array.isArray(liveStream.reactions) ? liveStream.reactions.length : 0;
    const donationsCount = liveStream.monetization?.donations?.length || 0;
    const totalEarnings = liveStream.monetization?.totalEarnings || 0;

    const engagementData = {
      totalViews: liveStream.totalViews,
      uniqueViewers: uniqueViewersCount,
      peakViewers: liveStream.peakViewers,
      currentViewers: liveStream.currentViewers,
      averageWatchTime: 0, // Not tracking this detailed yet
      chatMessages: chatMessagesCount,
      reactions: reactionsCount,
      likes: liveStream.likes,
      shares: 0,
      engagementRate: 0,
      donations: donationsCount,
      totalEarnings: totalEarnings,
      deviceStats: {},
      topCountries: [],
      duration: liveStream.duration,
      durationFormatted: formatDuration(liveStream.duration)
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

function formatDuration(seconds) {
    if (!seconds) return '0:00';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

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

    const liveStream = await prisma.liveStream.findUnique({
        where: { id: streamId }
    });

    if (!liveStream) {
      return res.status(404).json({
        success: false,
        message: 'Stream not found'
      });
    }

    if (liveStream.hostId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Only the host can add moderators'
      });
    }

    const user = await prisma.user.findUnique({
        where: { id: userId }
    });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update features.moderation.moderators
    const features = liveStream.features || {};
    const moderation = features.moderation || { moderators: [], bannedUsers: [] };
    const moderators = moderation.moderators || [];
    
    if (!moderators.includes(userId)) {
        moderators.push(userId);
        
        await prisma.liveStream.update({
            where: { id: streamId },
            data: {
                features: {
                    ...features,
                    moderation: {
                        ...moderation,
                        moderators
                    }
                }
            }
        });
    }

    res.json({
      success: true,
      message: 'Moderator added successfully',
      data: {
        moderator: {
          userId: user.id,
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

    const liveStream = await prisma.liveStream.findUnique({
        where: { id: streamId }
    });

    if (!liveStream) {
      return res.status(404).json({
        success: false,
        message: 'Stream not found'
      });
    }

    if (liveStream.hostId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Only the host can remove moderators'
      });
    }

    const features = liveStream.features || {};
    const moderation = features.moderation || { moderators: [] };
    let moderators = moderation.moderators || [];
    
    if (moderators.includes(userId)) {
        moderators = moderators.filter(id => id !== userId);
        
        await prisma.liveStream.update({
            where: { id: streamId },
            data: {
                features: {
                    ...features,
                    moderation: {
                        ...moderation,
                        moderators
                    }
                }
            }
        });
    }

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

    const liveStream = await prisma.liveStream.findUnique({
        where: { id: streamId }
    });

    if (!liveStream) {
      return res.status(404).json({
        success: false,
        message: 'Stream not found'
      });
    }

    // Check features.donationsEnabled
    const features = liveStream.features || {};
    if (!features.donationsEnabled) {
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

    const monetization = liveStream.monetization || { donations: [], totalEarnings: 0 };
    const donations = monetization.donations || [];
    donations.push(donation);
    const totalEarnings = (monetization.totalEarnings || 0) + parseFloat(amount);

    await prisma.liveStream.update({
        where: { id: streamId },
        data: {
            monetization: {
                ...monetization,
                donations,
                totalEarnings
            }
        }
    });

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
