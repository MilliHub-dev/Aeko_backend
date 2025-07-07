import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { v4 as uuidV4 } from "uuid";
import User from "../models/User.js";
import LiveStream from "../models/LiveStream.js";
import EnhancedMessage from "../models/EnhancedMessage.js";

class EnhancedLiveStreamSocket {
  constructor(server) {
    this.io = new Server(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      },
      transports: ['websocket', 'polling']
    });

    this.activeStreams = new Map(); // streamId -> stream data
    this.viewers = new Map(); // streamId -> Set of userIds
    this.streamConnections = new Map(); // streamId -> Set of socket connections
    this.userSockets = new Map(); // userId -> socket
    this.rtcConnections = new Map(); // streamId -> WebRTC connections
    
    this.setupSocket();
  }

  setupSocket() {
    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
        
        if (!token) {
          return next(new Error('Authentication error: No token provided'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id || decoded.userId).select('-password');
        
        if (!user) {
          return next(new Error('Authentication error: User not found'));
        }

        socket.userId = user._id.toString();
        socket.user = user;
        next();
      } catch (error) {
        next(new Error('Authentication error: Invalid token'));
      }
    });

    this.io.on("connection", (socket) => {
      this.handleConnection(socket);
    });
  }

  handleConnection(socket) {
    console.log(`🔴 Livestream user connected: ${socket.user.username} (${socket.userId})`);
    
    // Store user socket
    this.userSockets.set(socket.userId, socket);
    
    // Register event handlers
    this.registerEventHandlers(socket);

    socket.on('disconnect', () => {
      this.handleDisconnection(socket);
    });
  }

  registerEventHandlers(socket) {
    // === STREAM MANAGEMENT ===
    socket.on('create_stream', (data) => this.handleCreateStream(socket, data));
    socket.on('start_stream', (data) => this.handleStartStream(socket, data));
    socket.on('end_stream', (data) => this.handleEndStream(socket, data));
    socket.on('update_stream', (data) => this.handleUpdateStream(socket, data));
    socket.on('schedule_stream', (data) => this.handleScheduleStream(socket, data));
    
    // === VIEWER MANAGEMENT ===
    socket.on('join_stream', (data) => this.handleJoinStream(socket, data));
    socket.on('leave_stream', (data) => this.handleLeaveStream(socket, data));
    socket.on('get_stream_info', (data) => this.handleGetStreamInfo(socket, data));
    
    // === WEBRTC SIGNALING ===
    socket.on('offer', (data) => this.handleWebRTCOffer(socket, data));
    socket.on('answer', (data) => this.handleWebRTCAnswer(socket, data));
    socket.on('ice_candidate', (data) => this.handleICECandidate(socket, data));
    socket.on('peer_disconnected', (data) => this.handlePeerDisconnected(socket, data));
    
    // === STREAM CHAT ===
    socket.on('stream_chat_message', (data) => this.handleStreamChatMessage(socket, data));
    socket.on('stream_chat_reaction', (data) => this.handleStreamChatReaction(socket, data));
    socket.on('stream_chat_typing', (data) => this.handleStreamChatTyping(socket, data));
    
    // === REACTIONS & ENGAGEMENT ===
    socket.on('stream_reaction', (data) => this.handleStreamReaction(socket, data));
    socket.on('stream_like', (data) => this.handleStreamLike(socket, data));
    socket.on('stream_share', (data) => this.handleStreamShare(socket, data));
    socket.on('stream_follow_host', (data) => this.handleFollowHost(socket, data));
    
    // === MONETIZATION ===
    socket.on('stream_donation', (data) => this.handleStreamDonation(socket, data));
    socket.on('stream_subscribe', (data) => this.handleStreamSubscribe(socket, data));
    socket.on('stream_gift', (data) => this.handleStreamGift(socket, data));
    
    // === MODERATION ===
    socket.on('ban_user', (data) => this.handleBanUser(socket, data));
    socket.on('unban_user', (data) => this.handleUnbanUser(socket, data));
    socket.on('add_moderator', (data) => this.handleAddModerator(socket, data));
    socket.on('remove_moderator', (data) => this.handleRemoveModerator(socket, data));
    socket.on('delete_chat_message', (data) => this.handleDeleteChatMessage(socket, data));
    socket.on('timeout_user', (data) => this.handleTimeoutUser(socket, data));
    
    // === CO-HOSTING & GUESTS ===
    socket.on('invite_co_host', (data) => this.handleInviteCoHost(socket, data));
    socket.on('accept_co_host', (data) => this.handleAcceptCoHost(socket, data));
    socket.on('remove_co_host', (data) => this.handleRemoveCoHost(socket, data));
    socket.on('invite_guest', (data) => this.handleInviteGuest(socket, data));
    socket.on('accept_guest_invite', (data) => this.handleAcceptGuestInvite(socket, data));
    socket.on('remove_guest', (data) => this.handleRemoveGuest(socket, data));
    
    // === SCREEN SHARING ===
    socket.on('start_screen_share', (data) => this.handleStartScreenShare(socket, data));
    socket.on('stop_screen_share', (data) => this.handleStopScreenShare(socket, data));
    
    // === RECORDING ===
    socket.on('start_recording', (data) => this.handleStartRecording(socket, data));
    socket.on('stop_recording', (data) => this.handleStopRecording(socket, data));
    socket.on('save_recording', (data) => this.handleSaveRecording(socket, data));
    
    // === STREAM QUALITY ===
    socket.on('change_quality', (data) => this.handleChangeQuality(socket, data));
    socket.on('report_stream_issue', (data) => this.handleReportStreamIssue(socket, data));
    socket.on('update_network_stats', (data) => this.handleUpdateNetworkStats(socket, data));
    
    // === DISCOVERY ===
    socket.on('get_trending_streams', (data) => this.handleGetTrendingStreams(socket, data));
    socket.on('get_category_streams', (data) => this.handleGetCategoryStreams(socket, data));
    socket.on('search_streams', (data) => this.handleSearchStreams(socket, data));
    socket.on('get_recommended_streams', (data) => this.handleGetRecommendedStreams(socket, data));
  }

  // === STREAM MANAGEMENT HANDLERS ===
  async handleCreateStream(socket, data) {
    try {
      const { title, description, category, streamType, features, quality, tags, scheduledFor } = data;

      const streamKey = uuidV4();
      const roomId = uuidV4();
      
      const streamData = {
        title,
        description,
        category: category || 'other',
        streamType: streamType || 'public',
        host: socket.userId,
        hostName: socket.user.username,
        hostProfilePicture: socket.user.profilePicture,
        streamKey,
        roomId,
        features: {
          chatEnabled: features?.chatEnabled ?? true,
          reactionsEnabled: features?.reactionsEnabled ?? true,
          screenShareEnabled: features?.screenShareEnabled ?? false,
          recordingEnabled: features?.recordingEnabled ?? false,
          donationsEnabled: features?.donationsEnabled ?? false,
          subscribersOnly: features?.subscribersOnly ?? false,
          moderationEnabled: features?.moderationEnabled ?? true
        },
        quality: {
          resolution: quality?.resolution || '720p',
          bitrate: quality?.bitrate || 2500,
          fps: quality?.fps || 30,
          codec: quality?.codec || 'H.264'
        },
        tags: tags || [],
        scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
        metadata: {
          streamProtocol: 'WebRTC'
        }
      };

      const liveStream = new LiveStream(streamData);
      await liveStream.save();

      // Store in active streams
      this.activeStreams.set(liveStream._id.toString(), {
        ...liveStream.toObject(),
        socket: socket.id,
        connections: new Set()
      });

      // Generate streaming URLs
      const streamUrls = {
        rtmp: `rtmp://localhost:1935/live/${streamKey}`,
        webrtc: `ws://localhost:5000/webrtc/${roomId}`,
        hls: `http://localhost:8080/hls/${streamKey}/index.m3u8`
      };

      socket.emit('stream_created', {
        streamId: liveStream._id,
        streamKey,
        roomId,
        urls: streamUrls,
        stream: liveStream
      });

      console.log(`🎥 Stream created: ${title} by ${socket.user.username}`);
    } catch (error) {
      console.error('Create stream error:', error);
      socket.emit('stream_error', { error: error.message });
    }
  }

  async handleStartStream(socket, data) {
    try {
      const { streamId } = data;

      const liveStream = await LiveStream.findById(streamId);
      if (!liveStream || liveStream.host.toString() !== socket.userId) {
        return socket.emit('stream_error', { error: 'Stream not found or unauthorized' });
      }

      await liveStream.startStream();
      
      // Update active streams
      if (this.activeStreams.has(streamId)) {
        this.activeStreams.get(streamId).status = 'live';
      }

      // Initialize viewer tracking
      this.viewers.set(streamId, new Set());
      this.streamConnections.set(streamId, new Set());

      // Notify followers/subscribers
      this.notifyStreamStart(liveStream);

      socket.emit('stream_started', {
        streamId,
        startedAt: liveStream.startedAt
      });

      // Broadcast to discovery
      this.io.emit('new_live_stream', {
        streamId,
        title: liveStream.title,
        hostName: liveStream.hostName,
        category: liveStream.category,
        currentViewers: 0
      });

      console.log(`🔴 Stream started: ${liveStream.title}`);
    } catch (error) {
      console.error('Start stream error:', error);
      socket.emit('stream_error', { error: error.message });
    }
  }

  async handleJoinStream(socket, data) {
    try {
      const { streamId } = data;

      const liveStream = await LiveStream.findById(streamId);
      if (!liveStream) {
        return socket.emit('stream_error', { error: 'Stream not found' });
      }

      // Check if user is banned
      const isBanned = liveStream.moderation.bannedUsers.some(
        ban => ban.userId.toString() === socket.userId
      );
      if (isBanned) {
        return socket.emit('stream_error', { error: 'You are banned from this stream' });
      }

      // Check stream access permissions
      if (liveStream.streamType === 'private') {
        return socket.emit('stream_error', { error: 'This is a private stream' });
      }

      if (liveStream.streamType === 'followers_only') {
        // Check if user follows the host
        const isFollowing = await this.checkIfFollowing(socket.userId, liveStream.host);
        if (!isFollowing) {
          return socket.emit('stream_error', { error: 'This stream is for followers only' });
        }
      }

      if (liveStream.streamType === 'paid' && liveStream.monetization.ticketPrice > 0) {
        // Check if user has paid
        const hasPaid = await this.checkIfPaid(socket.userId, streamId);
        if (!hasPaid) {
          return socket.emit('stream_error', { 
            error: 'Payment required',
            ticketPrice: liveStream.monetization.ticketPrice,
            currency: liveStream.monetization.currency
          });
        }
      }

      // Join stream room
      socket.join(streamId);
      
      // Add viewer
      if (!this.viewers.has(streamId)) {
        this.viewers.set(streamId, new Set());
      }
      this.viewers.get(streamId).add(socket.userId);
      
      if (!this.streamConnections.has(streamId)) {
        this.streamConnections.set(streamId, new Set());
      }
      this.streamConnections.get(streamId).add(socket.id);

      // Update viewer count
      await liveStream.addViewer(socket.userId);
      
      const currentViewers = this.viewers.get(streamId).size;

      // Send stream info to viewer
      socket.emit('stream_joined', {
        streamId,
        stream: liveStream,
        currentViewers,
        roomId: liveStream.roomId
      });

      // Notify stream about new viewer
      socket.to(streamId).emit('viewer_joined', {
        userId: socket.userId,
        username: socket.user.username,
        currentViewers
      });

      // Send viewer count update
      this.io.to(streamId).emit('viewer_count_update', { currentViewers });

      console.log(`👁️ ${socket.user.username} joined stream: ${liveStream.title}`);
    } catch (error) {
      console.error('Join stream error:', error);
      socket.emit('stream_error', { error: error.message });
    }
  }

  async handleLeaveStream(socket, data) {
    try {
      const { streamId } = data;

      socket.leave(streamId);
      
      // Remove viewer
      if (this.viewers.has(streamId)) {
        this.viewers.get(streamId).delete(socket.userId);
      }
      
      if (this.streamConnections.has(streamId)) {
        this.streamConnections.get(streamId).delete(socket.id);
      }

      // Update viewer count
      const liveStream = await LiveStream.findById(streamId);
      if (liveStream) {
        await liveStream.removeViewer();
        
        const currentViewers = this.viewers.get(streamId)?.size || 0;
        
        // Notify stream about viewer leaving
        socket.to(streamId).emit('viewer_left', {
          userId: socket.userId,
          username: socket.user.username,
          currentViewers
        });

        // Send viewer count update
        this.io.to(streamId).emit('viewer_count_update', { currentViewers });
      }

      socket.emit('stream_left', { streamId });
      console.log(`👋 ${socket.user.username} left stream: ${streamId}`);
    } catch (error) {
      console.error('Leave stream error:', error);
      socket.emit('stream_error', { error: error.message });
    }
  }

  // === WEBRTC SIGNALING HANDLERS ===
  handleWebRTCOffer(socket, data) {
    const { streamId, offer, targetUserId } = data;
    
    if (targetUserId) {
      // Send offer to specific user
      const targetSocket = this.userSockets.get(targetUserId);
      if (targetSocket) {
        targetSocket.emit('webrtc_offer', {
          streamId,
          offer,
          fromUserId: socket.userId,
          fromUsername: socket.user.username
        });
      }
    } else {
      // Broadcast offer to all viewers
      socket.to(streamId).emit('webrtc_offer', {
        streamId,
        offer,
        fromUserId: socket.userId,
        fromUsername: socket.user.username
      });
    }
  }

  handleWebRTCAnswer(socket, data) {
    const { streamId, answer, targetUserId } = data;
    
    const targetSocket = this.userSockets.get(targetUserId);
    if (targetSocket) {
      targetSocket.emit('webrtc_answer', {
        streamId,
        answer,
        fromUserId: socket.userId,
        fromUsername: socket.user.username
      });
    }
  }

  handleICECandidate(socket, data) {
    const { streamId, candidate, targetUserId } = data;
    
    const targetSocket = this.userSockets.get(targetUserId);
    if (targetSocket) {
      targetSocket.emit('ice_candidate', {
        streamId,
        candidate,
        fromUserId: socket.userId
      });
    }
  }

  // === STREAM CHAT HANDLERS ===
  async handleStreamChatMessage(socket, data) {
    try {
      const { streamId, message, replyToId } = data;

      const liveStream = await LiveStream.findById(streamId);
      if (!liveStream || !liveStream.features.chatEnabled) {
        return socket.emit('stream_error', { error: 'Chat is disabled for this stream' });
      }

      // Check if user is banned or timed out
      const isBanned = liveStream.moderation.bannedUsers.some(
        ban => ban.userId.toString() === socket.userId
      );
      if (isBanned) {
        return socket.emit('stream_error', { error: 'You are banned from chatting' });
      }

      // Create chat message
      const chatMessage = new EnhancedMessage({
        sender: socket.userId,
        receiver: liveStream.host,
        chatId: streamId,
        content: message,
        messageType: 'text',
        metadata: {
          streamChat: true,
          deviceType: 'web'
        }
      });

      if (replyToId) {
        chatMessage.replyTo = replyToId;
      }

      await chatMessage.save();
      await chatMessage.populate('sender', 'username profilePicture verified');

      // Update analytics
      liveStream.analytics.chatMessages += 1;
      await liveStream.save();

      // Broadcast message to all stream viewers
      this.io.to(streamId).emit('stream_chat_message', {
        messageId: chatMessage._id,
        streamId,
        sender: {
          userId: socket.userId,
          username: socket.user.username,
          profilePicture: socket.user.profilePicture,
          verified: socket.user.verified
        },
        message,
        timestamp: chatMessage.createdAt,
        replyTo: replyToId
      });

      console.log(`💬 Chat message in stream ${streamId}: ${socket.user.username}: ${message}`);
    } catch (error) {
      console.error('Stream chat message error:', error);
      socket.emit('stream_error', { error: error.message });
    }
  }

  async handleStreamReaction(socket, data) {
    try {
      const { streamId, emoji } = data;

      const liveStream = await LiveStream.findById(streamId);
      if (!liveStream || !liveStream.features.reactionsEnabled) {
        return socket.emit('stream_error', { error: 'Reactions are disabled for this stream' });
      }

      await liveStream.addReaction(socket.userId, emoji);

      // Broadcast reaction to all stream viewers
      this.io.to(streamId).emit('stream_reaction', {
        streamId,
        userId: socket.userId,
        username: socket.user.username,
        emoji,
        timestamp: new Date()
      });

      console.log(`👍 Stream reaction: ${socket.user.username} reacted with ${emoji}`);
    } catch (error) {
      console.error('Stream reaction error:', error);
      socket.emit('stream_error', { error: error.message });
    }
  }

  // === MONETIZATION HANDLERS ===
  async handleStreamDonation(socket, data) {
    try {
      const { streamId, amount, message, currency } = data;

      const liveStream = await LiveStream.findById(streamId);
      if (!liveStream || !liveStream.features.donationsEnabled) {
        return socket.emit('stream_error', { error: 'Donations are disabled for this stream' });
      }

      // Process donation (integrate with payment system)
      const donation = {
        userId: socket.userId,
        amount,
        message: message || '',
        timestamp: new Date()
      };

      liveStream.monetization.donations.push(donation);
      liveStream.monetization.totalEarnings += amount;
      await liveStream.save();

      // Notify host
      const hostSocket = this.userSockets.get(liveStream.host.toString());
      if (hostSocket) {
        hostSocket.emit('donation_received', {
          streamId,
          donation: {
            ...donation,
            username: socket.user.username,
            profilePicture: socket.user.profilePicture
          }
        });
      }

      // Broadcast donation to viewers (if enabled)
      this.io.to(streamId).emit('stream_donation', {
        streamId,
        donor: {
          username: socket.user.username,
          profilePicture: socket.user.profilePicture
        },
        amount,
        currency: currency || 'USD',
        message,
        timestamp: new Date()
      });

      socket.emit('donation_sent', { streamId, amount, currency });
      console.log(`💰 Donation: ${socket.user.username} donated ${amount} to ${liveStream.title}`);
    } catch (error) {
      console.error('Stream donation error:', error);
      socket.emit('stream_error', { error: error.message });
    }
  }

  // === MODERATION HANDLERS ===
  async handleBanUser(socket, data) {
    try {
      const { streamId, userId, reason } = data;

      const liveStream = await LiveStream.findById(streamId);
      if (!liveStream) {
        return socket.emit('stream_error', { error: 'Stream not found' });
      }

      // Check if user has moderation permissions
      const isModerator = liveStream.host.toString() === socket.userId || 
                         liveStream.moderation.moderators.includes(socket.userId);
      
      if (!isModerator) {
        return socket.emit('stream_error', { error: 'Insufficient permissions' });
      }

      await liveStream.banUser(userId, reason);

      // Remove banned user from stream
      const bannedUserSocket = this.userSockets.get(userId);
      if (bannedUserSocket) {
        bannedUserSocket.leave(streamId);
        bannedUserSocket.emit('banned_from_stream', {
          streamId,
          reason,
          timestamp: new Date()
        });
      }

      // Remove from viewer count
      if (this.viewers.has(streamId)) {
        this.viewers.get(streamId).delete(userId);
      }

      // Notify moderators
      this.io.to(streamId).emit('user_banned', {
        streamId,
        userId,
        reason,
        moderatorId: socket.userId,
        timestamp: new Date()
      });

      console.log(`🚫 User banned: ${userId} from stream ${streamId} by ${socket.user.username}`);
    } catch (error) {
      console.error('Ban user error:', error);
      socket.emit('stream_error', { error: error.message });
    }
  }

  // === DISCOVERY HANDLERS ===
  async handleGetTrendingStreams(socket, data) {
    try {
      const { limit = 10 } = data;
      
      const trendingStreams = await LiveStream.getTrending(limit);
      
      // Add current viewer counts
      const streamsWithViewers = trendingStreams.map(stream => ({
        ...stream.toObject(),
        currentViewers: this.viewers.get(stream._id.toString())?.size || 0
      }));

      socket.emit('trending_streams', { streams: streamsWithViewers });
    } catch (error) {
      console.error('Get trending streams error:', error);
      socket.emit('stream_error', { error: error.message });
    }
  }

  async handleGetCategoryStreams(socket, data) {
    try {
      const { category, limit = 20 } = data;
      
      const categoryStreams = await LiveStream.getByCategory(category, limit);
      
      // Add current viewer counts
      const streamsWithViewers = categoryStreams.map(stream => ({
        ...stream.toObject(),
        currentViewers: this.viewers.get(stream._id.toString())?.size || 0
      }));

      socket.emit('category_streams', { 
        category, 
        streams: streamsWithViewers 
      });
    } catch (error) {
      console.error('Get category streams error:', error);
      socket.emit('stream_error', { error: error.message });
    }
  }

  async handleSearchStreams(socket, data) {
    try {
      const { query, filters = {} } = data;
      
      const searchResults = await LiveStream.searchStreams(query, filters);
      
      // Add current viewer counts
      const streamsWithViewers = searchResults.map(stream => ({
        ...stream.toObject(),
        currentViewers: this.viewers.get(stream._id.toString())?.size || 0
      }));

      socket.emit('search_results', { 
        query, 
        streams: streamsWithViewers,
        total: streamsWithViewers.length
      });
    } catch (error) {
      console.error('Search streams error:', error);
      socket.emit('stream_error', { error: error.message });
    }
  }

  // === UTILITY METHODS ===
  async notifyStreamStart(liveStream) {
    // Notify followers/subscribers about stream start
    // This would integrate with your user following/subscription system
    console.log(`📢 Notifying followers about stream start: ${liveStream.title}`);
  }

  async checkIfFollowing(userId, hostId) {
    // Check if user follows the host
    // Implement based on your following system
    return true; // Placeholder
  }

  async checkIfPaid(userId, streamId) {
    // Check if user has paid for the stream
    // Implement based on your payment system
    return true; // Placeholder
  }

  handleDisconnection(socket) {
    console.log(`❌ Livestream user disconnected: ${socket.user?.username} (${socket.userId})`);
    
    // Remove from all streams
    for (const [streamId, viewers] of this.viewers) {
      if (viewers.has(socket.userId)) {
        this.handleLeaveStream(socket, { streamId });
      }
    }

    // Remove socket mapping
    this.userSockets.delete(socket.userId);

    // Clean up stream connections
    for (const [streamId, connections] of this.streamConnections) {
      connections.delete(socket.id);
      
      // If this was the host and stream has no viewers, end the stream
      const activeStream = this.activeStreams.get(streamId);
      if (activeStream && activeStream.socket === socket.id && connections.size === 0) {
        this.endStreamCleanup(streamId);
      }
    }
  }

  async endStreamCleanup(streamId) {
    try {
      const liveStream = await LiveStream.findById(streamId);
      if (liveStream) {
        await liveStream.endStream();
      }

      // Clean up tracking data
      this.activeStreams.delete(streamId);
      this.viewers.delete(streamId);
      this.streamConnections.delete(streamId);
      this.rtcConnections.delete(streamId);

      // Notify all connected clients
      this.io.to(streamId).emit('stream_ended', { streamId });

      console.log(`🔴 Stream ended and cleaned up: ${streamId}`);
    } catch (error) {
      console.error('End stream cleanup error:', error);
    }
  }

  // === PUBLIC METHODS ===
  getActiveStreams() {
    return Array.from(this.activeStreams.values());
  }

  getStreamViewers(streamId) {
    return this.viewers.get(streamId) || new Set();
  }

  getStreamConnections(streamId) {
    return this.streamConnections.get(streamId) || new Set();
  }

  isStreamActive(streamId) {
    return this.activeStreams.has(streamId);
  }

  getSystemStats() {
    return {
      activeStreams: this.activeStreams.size,
      totalViewers: Array.from(this.viewers.values()).reduce((sum, viewers) => sum + viewers.size, 0),
      connectedUsers: this.userSockets.size,
      totalConnections: this.io.sockets.sockets.size
    };
  }
}

export default EnhancedLiveStreamSocket;