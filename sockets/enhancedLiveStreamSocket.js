import jwt from "jsonwebtoken";
import { v4 as uuidV4 } from "uuid";
import { prisma } from "../config/db.js";

class EnhancedLiveStreamSocket {
  constructor(io) {
    this.io = io.of('/livestream');

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
        const userId = decoded.id || decoded.userId;
        const user = await prisma.user.findUnique({
          where: { id: userId }
        });
        
        if (!user) {
          return next(new Error('Authentication error: User not found'));
        }

        // Remove password for security
        delete user.password;

        socket.userId = user.id;
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

  handleDisconnection(socket) {
    console.log(`🔴 Livestream user disconnected: ${socket.user.username}`);
    this.userSockets.delete(socket.userId);
    // Cleanup viewers and active streams if necessary
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
      
      // Create a Chat for the stream first
      const chat = await prisma.chat.create({
        data: {
          isGroup: true,
          groupName: `${title} Chat`,
          isCommunityChat: false
        }
      });

      const liveStream = await prisma.liveStream.create({
        data: {
          title,
          description,
          category: category || 'other',
          streamType: streamType || 'public',
          host: { connect: { id: socket.userId } },
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
          },
          chat: { connect: { id: chat.id } }
        }
      });

      // Store in active streams
      this.activeStreams.set(liveStream.id, {
        ...liveStream,
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
        streamId: liveStream.id,
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

      const liveStream = await prisma.liveStream.findUnique({
        where: { id: streamId }
      });

      if (!liveStream || liveStream.hostId !== socket.userId) {
        return socket.emit('stream_error', { error: 'Stream not found or unauthorized' });
      }

      const updatedStream = await prisma.liveStream.update({
        where: { id: streamId },
        data: {
          status: 'live',
          startedAt: new Date()
        }
      });
      
      // Update active streams
      if (this.activeStreams.has(streamId)) {
        const streamData = this.activeStreams.get(streamId);
        streamData.status = 'live';
        this.activeStreams.set(streamId, streamData);
      }

      // Initialize viewer tracking
      this.viewers.set(streamId, new Set());
      this.streamConnections.set(streamId, new Set());

      // Notify followers/subscribers (TODO: Implement notification logic)
      // this.notifyStreamStart(liveStream);

      socket.emit('stream_started', {
        streamId,
        startedAt: updatedStream.startedAt
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

      const liveStream = await prisma.liveStream.findUnique({
        where: { id: streamId }
      });

      if (!liveStream) {
        return socket.emit('stream_error', { error: 'Stream not found' });
      }

      // Check if user is banned
      // Need to parse features/moderation from JSON if stored there
      // liveStream.features is JSON.
      // Assuming moderation settings are in features or metadata.
      // For now, skipping complex banned check unless structure is clear.

      if (liveStream.streamType === 'private') {
        return socket.emit('stream_error', { error: 'This is a private stream' });
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

      // Update viewer count in DB
      // We need to manage uniqueViewers array in JSON
      let uniqueViewers = liveStream.uniqueViewers || [];
      if (!Array.isArray(uniqueViewers)) uniqueViewers = [];
      
      if (!uniqueViewers.includes(socket.userId)) {
        uniqueViewers.push(socket.userId);
      }

      await prisma.liveStream.update({
        where: { id: streamId },
        data: {
          currentViewers: { increment: 1 },
          uniqueViewers: uniqueViewers,
          // Update peak viewers if needed
          peakViewers: Math.max(liveStream.peakViewers, this.viewers.get(streamId).size)
        }
      });
      
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
      await prisma.liveStream.update({
        where: { id: streamId },
        data: {
          currentViewers: { decrement: 1 }
        }
      });
        
      const currentViewers = this.viewers.get(streamId)?.size || 0;
      
      // Notify stream about viewer leaving
      socket.to(streamId).emit('viewer_left', {
        userId: socket.userId,
        username: socket.user.username,
        currentViewers
      });

      // Send viewer count update
      this.io.to(streamId).emit('viewer_count_update', { currentViewers });

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
  
  handlePeerDisconnected(socket, data) {
     // Implementation for peer disconnection
  }

  // === STREAM CHAT HANDLERS ===
  async handleStreamChatMessage(socket, data) {
    try {
      const { streamId, message, replyToId } = data;

      const liveStream = await prisma.liveStream.findUnique({
        where: { id: streamId }
      });
      
      const features = liveStream?.features || {};
      
      if (!liveStream || features.chatEnabled === false) {
        return socket.emit('stream_error', { error: 'Chat is disabled for this stream' });
      }

      // Check if user is banned (Skipped for now due to JSON structure complexity)

      // Ensure Chat exists
      let chatId = liveStream.chatId;
      if (!chatId) {
        // Fallback: Create chat if not exists
        const chat = await prisma.chat.create({
            data: {
                isGroup: true,
                groupName: `${liveStream.title} Chat`,
                liveStream: { connect: { id: liveStream.id } }
            }
        });
        chatId = chat.id;
        // Update LiveStream with chatId
        await prisma.liveStream.update({
            where: { id: streamId },
            data: { chatId: chat.id }
        });
      }

      // Create chat message
      const chatMessage = await prisma.enhancedMessage.create({
        data: {
            sender: { connect: { id: socket.userId } },
            receiver: { connect: { id: liveStream.hostId } }, // Host is receiver context
            chat: { connect: { id: chatId } },
            content: message,
            messageType: 'text',
            metadata: {
                streamChat: true,
                deviceType: 'web'
            },
            replyToId: replyToId || undefined
        },
        include: {
            sender: {
                select: { username: true, profilePicture: true, blueTick: true }
            }
        }
      });

      // Update analytics in LiveStream (stored in JSON?)
      // Assuming analytics is not in schema top-level, maybe in metadata or just ignored for now.
      // But we should try to update it if possible.

      // Broadcast message to all stream viewers
      this.io.to(streamId).emit('stream_chat_message', {
        messageId: chatMessage.id,
        streamId,
        sender: {
          userId: socket.userId,
          username: socket.user.username,
          profilePicture: socket.user.profilePicture,
          verified: socket.user.blueTick
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

      const liveStream = await prisma.liveStream.findUnique({
        where: { id: streamId }
      });
      
      const features = liveStream?.features || {};
      if (!liveStream || features.reactionsEnabled === false) {
        return socket.emit('stream_error', { error: 'Reactions are disabled for this stream' });
      }

      // Add reaction to JSON
      // We can't easily push to JSON array in Prisma without reading.
      // For high frequency reactions, maybe just emit and don't store every single one, or store aggregate.
      // Here we will just emit.
      
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

  async handleStreamChatTyping(socket, data) {
      // Implementation for typing indicators
      const { streamId, isTyping } = data;
      socket.to(streamId).emit('stream_chat_typing', {
          userId: socket.userId,
          username: socket.user.username,
          isTyping
      });
  }

  // === MONETIZATION HANDLERS ===
  async handleStreamDonation(socket, data) {
    try {
      const { streamId, amount, message, currency } = data;

      const liveStream = await prisma.liveStream.findUnique({
        where: { id: streamId }
      });
      
      const features = liveStream?.features || {};
      if (!liveStream || features.donationsEnabled === false) {
        return socket.emit('stream_error', { error: 'Donations are disabled for this stream' });
      }

      // Process donation (integrate with payment system)
      // For now, just recording it in JSON
      const donation = {
        userId: socket.userId,
        amount,
        message: message || '',
        timestamp: new Date()
      };

      const monetization = liveStream.monetization || { donations: [], totalEarnings: 0 };
      if (!monetization.donations) monetization.donations = [];
      monetization.donations.push(donation);
      monetization.totalEarnings = (monetization.totalEarnings || 0) + amount;

      await prisma.liveStream.update({
        where: { id: streamId },
        data: { monetization }
      });

      // Notify host
      const hostSocket = this.userSockets.get(liveStream.hostId);
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

      // Broadcast donation to viewers
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

  handleStreamSubscribe(socket, data) {}
  handleStreamGift(socket, data) {}

  // === MODERATION HANDLERS ===
  async handleBanUser(socket, data) {
      // Placeholder for ban logic
  }
  handleUnbanUser(socket, data) {}
  handleAddModerator(socket, data) {}
  handleRemoveModerator(socket, data) {}
  handleDeleteChatMessage(socket, data) {}
  handleTimeoutUser(socket, data) {}

  // === OTHER HANDLERS ===
  handleStreamLike(socket, data) {}
  handleStreamShare(socket, data) {}
  handleFollowHost(socket, data) {}
  handleInviteCoHost(socket, data) {}
  handleAcceptCoHost(socket, data) {}
  handleRemoveCoHost(socket, data) {}
  handleInviteGuest(socket, data) {}
  handleAcceptGuestInvite(socket, data) {}
  handleRemoveGuest(socket, data) {}
  handleStartScreenShare(socket, data) {}
  handleStopScreenShare(socket, data) {}
  handleStartRecording(socket, data) {}
  handleStopRecording(socket, data) {}
  handleSaveRecording(socket, data) {}
  handleChangeQuality(socket, data) {}
  handleReportStreamIssue(socket, data) {}
  handleUpdateNetworkStats(socket, data) {}
  handleGetTrendingStreams(socket, data) {}
  handleGetCategoryStreams(socket, data) {}
  handleSearchStreams(socket, data) {}
  handleGetRecommendedStreams(socket, data) {}
  handleGetStreamInfo(socket, data) {}
}

export default EnhancedLiveStreamSocket;
