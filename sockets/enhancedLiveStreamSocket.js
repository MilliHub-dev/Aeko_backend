import jwt from "jsonwebtoken";
import { v4 as uuidV4 } from "uuid";
import { prisma } from "../config/db.js";
import { getGiftById, HOST_COIN_SHARE } from "../config/giftCatalog.js";

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

  getCollaborationState(features = {}) {
    const collaboration = features?.collaboration || {};

    return {
      coHosts: Array.isArray(collaboration.coHosts) ? collaboration.coHosts : [],
      guests: Array.isArray(collaboration.guests) ? collaboration.guests : [],
      pendingCoHostInvites: Array.isArray(collaboration.pendingCoHostInvites)
        ? collaboration.pendingCoHostInvites
        : [],
      pendingGuestInvites: Array.isArray(collaboration.pendingGuestInvites)
        ? collaboration.pendingGuestInvites
        : []
    };
  }

  async getLiveStream(streamId) {
    return prisma.liveStream.findUnique({
      where: { id: streamId }
    });
  }

  isCoHost(userId, liveStream) {
    const collaboration = this.getCollaborationState(liveStream?.features);
    return collaboration.coHosts.includes(userId);
  }

  isHostOrCoHost(userId, liveStream) {
    return liveStream?.hostId === userId || this.isCoHost(userId, liveStream);
  }

  async saveCollaborationState(liveStream, collaboration) {
    const features = {
      ...(liveStream.features || {}),
      collaboration
    };

    return prisma.liveStream.update({
      where: { id: liveStream.id },
      data: { features }
    });
  }

  async ensureChatMembership(chatId, userId) {
    if (!chatId || !userId) return;

    const existingMember = await prisma.chatMember.findUnique({
      where: {
        chatId_userId: {
          chatId,
          userId
        }
      }
    });

    if (!existingMember) {
      await prisma.chatMember.create({
        data: {
          chatId,
          userId
        }
      });
    }
  }

  getBroadcasterRole(userId, liveStream) {
    if (liveStream?.hostId === userId) return 'host';

    const collaboration = this.getCollaborationState(liveStream?.features);
    if (collaboration.coHosts.includes(userId)) return 'co_host';
    if (collaboration.guests.includes(userId)) return 'guest';

    return null;
  }

  getAudienceUserIds(streamId, broadcasterUserId) {
    const viewerIds = Array.from(this.viewers.get(streamId) || []);
    return viewerIds.filter((userId) => userId !== broadcasterUserId);
  }

  async emitParticipantUpdate(streamId, liveStream) {
    const stream = liveStream || await this.getLiveStream(streamId);
    if (!stream) return;

    const collaboration = this.getCollaborationState(stream.features);

    this.io.to(streamId).emit('stream_participants_updated', {
      streamId,
      hostId: stream.hostId,
      coHosts: collaboration.coHosts,
      guests: collaboration.guests,
      pendingCoHostInvites: collaboration.pendingCoHostInvites,
      pendingGuestInvites: collaboration.pendingGuestInvites
    });
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
    socket.joinedStreams = new Set();
    socket.publishedStreams = new Set();
    this.userSockets.set(socket.userId, socket);
    
    // Register event handlers
    this.registerEventHandlers(socket);

    socket.on('disconnect', () => {
      this.handleDisconnection(socket);
    });
  }

  handleDisconnection(socket) {
    console.log(`🔴 Livestream user disconnected: ${socket.user.username}`);

    if (socket.joinedStreams) {
      for (const streamId of socket.joinedStreams) {
        if (this.viewers.has(streamId)) {
          this.viewers.get(streamId).delete(socket.userId);
        }

        if (this.streamConnections.has(streamId)) {
          this.streamConnections.get(streamId).delete(socket.id);
        }
      }
    }

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
    socket.on('begin_broadcast', (data) => this.handleBeginBroadcast(socket, data));
    socket.on('stop_broadcast', (data) => this.handleStopBroadcast(socket, data));
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

      if (!title || !title.trim()) {
        return socket.emit('stream_error', { error: 'Stream title is required' });
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

      await prisma.chatMember.create({
        data: {
          chatId: chat.id,
          userId: socket.userId
        }
      });

      const liveStream = await prisma.liveStream.create({
        data: {
          title: title.trim(),
          description: description?.trim() || '',
          category: category || 'other',
          streamType: streamType || 'public',
          user: { connect: { id: socket.userId } },
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
            moderationEnabled: features?.moderationEnabled ?? true,
            collaboration: {
              coHosts: [],
              guests: [],
              pendingCoHostInvites: [],
              pendingGuestInvites: []
            }
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
          chats: { connect: { id: chat.id } }
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
        _id: liveStream.id,
        streamKey,
        roomId,
        urls: streamUrls,
        stream: {
          ...liveStream,
          _id: liveStream.id
        }
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

  async handleEndStream(socket, data) {
    try {
      const { streamId } = data;

      const liveStream = await prisma.liveStream.findUnique({
        where: { id: streamId }
      });

      if (!liveStream || liveStream.hostId !== socket.userId) {
        return socket.emit('stream_error', { error: 'Stream not found or unauthorized' });
      }

      const endedAt = new Date();
      const duration = liveStream.startedAt
        ? Math.floor((endedAt.getTime() - new Date(liveStream.startedAt).getTime()) / 1000)
        : 0;

      const updatedStream = await prisma.liveStream.update({
        where: { id: streamId },
        data: {
          status: 'ended',
          endedAt,
          duration
        }
      });

      this.activeStreams.delete(streamId);
      this.viewers.delete(streamId);
      this.streamConnections.delete(streamId);
      this.rtcConnections.delete(streamId);

      socket.publishedStreams?.delete(streamId);
      socket.joinedStreams?.delete(streamId);

      this.io.to(streamId).emit('stream_ended', {
        streamId,
        endedAt: updatedStream.endedAt,
        duration: updatedStream.duration,
        status: updatedStream.status
      });

      this.io.emit('live_stream_ended', {
        streamId,
        status: 'ended',
        endedAt: updatedStream.endedAt
      });

      console.log(`⚫ Stream ended: ${liveStream.title}`);
    } catch (error) {
      console.error('End stream error:', error);
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
      socket.joinedStreams.add(streamId);
      
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
        roomId: liveStream.roomId,
        role: this.getBroadcasterRole(socket.userId, liveStream) || 'viewer',
        collaboration: this.getCollaborationState(liveStream.features)
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

      if (socket.publishedStreams?.has(streamId)) {
        await this.handleStopBroadcast(socket, { streamId, silent: true });
      }

      socket.leave(streamId);
      socket.joinedStreams?.delete(streamId);
      
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
  async handleBeginBroadcast(socket, data) {
    try {
      const { streamId } = data;

      const liveStream = await this.getLiveStream(streamId);
      if (!liveStream) {
        return socket.emit('stream_error', { error: 'Stream not found' });
      }

      const role = this.getBroadcasterRole(socket.userId, liveStream);
      if (!role) {
        return socket.emit('stream_error', { error: 'Only the host, co-hosts, or guests can broadcast' });
      }

      socket.join(streamId);
      socket.joinedStreams?.add(streamId);
      socket.publishedStreams?.add(streamId);

      const audienceUserIds = this.getAudienceUserIds(streamId, socket.userId);

      socket.emit('broadcast_ready', {
        streamId,
        role,
        audienceUserIds
      });

      this.io.to(streamId).emit('broadcaster_started', {
        streamId,
        userId: socket.userId,
        username: socket.user.username,
        profilePicture: socket.user.profilePicture,
        role
      });
    } catch (error) {
      console.error('Begin broadcast error:', error);
      socket.emit('stream_error', { error: error.message });
    }
  }

  async handleStopBroadcast(socket, data) {
    try {
      const { streamId, silent = false } = data;
      socket.publishedStreams?.delete(streamId);

      const liveStream = await this.getLiveStream(streamId);
      const role = this.getBroadcasterRole(socket.userId, liveStream);

      if (!silent) {
        socket.emit('broadcast_stopped', { streamId });
      }

      this.io.to(streamId).emit('broadcaster_stopped', {
        streamId,
        userId: socket.userId,
        role
      });
    } catch (error) {
      console.error('Stop broadcast error:', error);
      socket.emit('stream_error', { error: error.message });
    }
  }

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
                groupName: `${liveStream.title} Chat`
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

  async handleStreamSubscribe(socket, data) {
    try {
      const { streamId } = data;
      const liveStream = await prisma.liveStream.findUnique({ where: { id: streamId } });
      if (!liveStream) return socket.emit('stream_error', { error: 'Stream not found' });

      // Record subscription engagement in stream metadata
      const metadata = liveStream.metadata || {};
      const subscribers = metadata.subscribers || [];
      if (!subscribers.includes(socket.userId)) subscribers.push(socket.userId);
      await prisma.liveStream.update({
        where: { id: streamId },
        data: { metadata: { ...metadata, subscribers } }
      });

      // Notify host
      const hostSocket = this.userSockets.get(liveStream.hostId);
      if (hostSocket) {
        hostSocket.emit('new_subscriber', {
          streamId,
          subscriber: { userId: socket.userId, username: socket.user.username, profilePicture: socket.user.profilePicture }
        });
      }

      this.io.to(streamId).emit('stream_subscriber_alert', {
        streamId,
        username: socket.user.username,
        profilePicture: socket.user.profilePicture,
        timestamp: new Date()
      });

      socket.emit('subscribed_to_stream', { streamId });
    } catch (error) {
      console.error('Stream subscribe error:', error);
      socket.emit('stream_error', { error: error.message });
    }
  }

  async handleStreamGift(socket, data) {
    try {
      const { streamId, giftId, quantity = 1, message } = data;

      if (!streamId || !giftId) {
        return socket.emit('stream_error', { error: 'streamId and giftId are required' });
      }

      const gift = getGiftById(giftId);
      if (!gift) return socket.emit('stream_error', { error: 'Invalid gift' });

      const qty = Math.max(1, Math.min(parseInt(quantity) || 1, 100));
      const totalCoins = gift.coinCost * qty;

      // Fetch sender balance + stream atomically via transaction
      const [sender, liveStream] = await Promise.all([
        prisma.user.findUnique({ where: { id: socket.userId } }),
        prisma.liveStream.findUnique({ where: { id: streamId } })
      ]);

      if (!liveStream || liveStream.status !== 'live') {
        return socket.emit('stream_error', { error: 'Stream is not live' });
      }
      if (!sender || sender.coinBalance < totalCoins) {
        return socket.emit('stream_error', { error: 'Insufficient coin balance' });
      }

      const hostEarnings = Math.floor(totalCoins * HOST_COIN_SHARE);
      const newSenderBalance = sender.coinBalance - totalCoins;

      // Persist gift, deduct sender coins, credit host coins in one transaction
      await prisma.$transaction(async (tx) => {
        // Deduct from sender
        await tx.user.update({
          where: { id: socket.userId },
          data: { coinBalance: newSenderBalance }
        });

        // Credit host
        await tx.user.update({
          where: { id: liveStream.hostId },
          data: { coinBalance: { increment: hostEarnings } }
        });

        // Record gift
        await tx.liveStreamGift.create({
          data: {
            id: uuidV4(),
            streamId,
            senderId: socket.userId,
            hostId: liveStream.hostId,
            giftId: gift.id,
            giftName: gift.name,
            coinCost: gift.coinCost,
            quantity: qty,
            totalCoins,
            message: message || null
          }
        });

        // Log sender coin transaction
        await tx.coinTransaction.create({
          data: {
            id: uuidV4(),
            userId: socket.userId,
            type: 'gift_sent',
            amount: -totalCoins,
            balanceAfter: newSenderBalance,
            description: `Sent ${qty}x ${gift.name} on stream`,
            metadata: { streamId, giftId, quantity: qty }
          }
        });

        // Log host earning transaction
        const host = await tx.user.findUnique({ where: { id: liveStream.hostId }, select: { coinBalance: true } });
        await tx.coinTransaction.create({
          data: {
            id: uuidV4(),
            userId: liveStream.hostId,
            type: 'gift_received',
            amount: hostEarnings,
            balanceAfter: host.coinBalance,
            description: `Received ${qty}x ${gift.name} gift`,
            metadata: { streamId, giftId, senderId: socket.userId, quantity: qty }
          }
        });

        // Update stream monetization totals
        const mon = liveStream.monetization || { totalCoinsReceived: 0, totalGifts: 0 };
        await tx.liveStream.update({
          where: { id: streamId },
          data: {
            monetization: {
              ...mon,
              totalCoinsReceived: (mon.totalCoinsReceived || 0) + totalCoins,
              totalGifts: (mon.totalGifts || 0) + qty
            }
          }
        });
      });

      const giftPayload = {
        streamId,
        gift: { ...gift, quantity: qty, totalCoins },
        sender: { userId: socket.userId, username: socket.user.username, profilePicture: socket.user.profilePicture },
        message: message || null,
        timestamp: new Date()
      };

      // Broadcast gift animation to all viewers
      this.io.to(streamId).emit('stream_gift_received', giftPayload);

      // Alert host separately (in case they want a special overlay)
      const hostSocket = this.userSockets.get(liveStream.hostId);
      if (hostSocket) hostSocket.emit('gift_alert', { ...giftPayload, coinsEarned: hostEarnings });

      // Confirm to sender with updated balance
      socket.emit('gift_sent', { streamId, giftId, quantity: qty, totalCoins, newBalance: newSenderBalance });

      // Broadcast updated leaderboard top-5 to stream room
      await this._broadcastLeaderboard(streamId);

      console.log(`🎁 Gift: ${socket.user.username} sent ${qty}x ${gift.name} (${totalCoins} coins) to ${liveStream.title}`);
    } catch (error) {
      console.error('Stream gift error:', error);
      socket.emit('stream_error', { error: error.message });
    }
  }

  async _broadcastLeaderboard(streamId) {
    try {
      const top = await prisma.liveStreamGift.groupBy({
        by: ['senderId'],
        where: { streamId },
        _sum: { totalCoins: true },
        orderBy: { _sum: { totalCoins: 'desc' } },
        take: 5
      });

      const senderIds = top.map((r) => r.senderId);
      const users = await prisma.user.findMany({
        where: { id: { in: senderIds } },
        select: { id: true, username: true, profilePicture: true }
      });
      const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

      const leaderboard = top.map((r, i) => ({
        rank: i + 1,
        userId: r.senderId,
        username: userMap[r.senderId]?.username || 'Unknown',
        profilePicture: userMap[r.senderId]?.profilePicture || null,
        totalCoins: r._sum.totalCoins
      }));

      this.io.to(streamId).emit('leaderboard_update', { streamId, leaderboard });
    } catch (err) {
      console.error('Leaderboard broadcast error:', err);
    }
  }

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
  async handleInviteCoHost(socket, data) {
    try {
      const { streamId, userId } = data;

      const liveStream = await this.getLiveStream(streamId);
      if (!liveStream) {
        return socket.emit('stream_error', { error: 'Stream not found' });
      }

      if (liveStream.hostId !== socket.userId) {
        return socket.emit('stream_error', { error: 'Only the host can invite co-hosts' });
      }

      if (!userId || userId === socket.userId) {
        return socket.emit('stream_error', { error: 'A valid user is required' });
      }

      const targetUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, username: true, profilePicture: true }
      });

      if (!targetUser) {
        return socket.emit('stream_error', { error: 'User not found' });
      }

      const collaboration = this.getCollaborationState(liveStream.features);
      if (collaboration.coHosts.includes(userId)) {
        return socket.emit('stream_error', { error: 'User is already a co-host' });
      }

      const alreadyInvited = collaboration.pendingCoHostInvites.some((invite) => invite.userId === userId);
      if (!alreadyInvited) {
        collaboration.pendingCoHostInvites.push({
          userId,
          invitedBy: socket.userId,
          invitedAt: new Date().toISOString()
        });

        await this.saveCollaborationState(liveStream, collaboration);
      }

      const targetSocket = this.userSockets.get(userId);
      const payload = {
        streamId,
        invitedBy: {
          userId: socket.userId,
          username: socket.user.username,
          profilePicture: socket.user.profilePicture
        },
        stream: {
          id: liveStream.id,
          _id: liveStream.id,
          title: liveStream.title
        }
      };

      if (targetSocket) {
        targetSocket.emit('co_host_invited', payload);
      }

      socket.emit('co_host_invite_sent', {
        streamId,
        user: targetUser
      });
    } catch (error) {
      console.error('Invite co-host error:', error);
      socket.emit('stream_error', { error: error.message });
    }
  }

  async handleAcceptCoHost(socket, data) {
    try {
      const { streamId } = data;

      const liveStream = await this.getLiveStream(streamId);
      if (!liveStream) {
        return socket.emit('stream_error', { error: 'Stream not found' });
      }

      const collaboration = this.getCollaborationState(liveStream.features);
      const hasInvite = collaboration.pendingCoHostInvites.some((invite) => invite.userId === socket.userId);

      if (!hasInvite) {
        return socket.emit('stream_error', { error: 'No pending co-host invite found' });
      }

      collaboration.pendingCoHostInvites = collaboration.pendingCoHostInvites.filter(
        (invite) => invite.userId !== socket.userId
      );

      if (!collaboration.coHosts.includes(socket.userId)) {
        collaboration.coHosts.push(socket.userId);
      }

      await this.saveCollaborationState(liveStream, collaboration);
      await this.ensureChatMembership(liveStream.chatId, socket.userId);

      const payload = {
        streamId,
        user: {
          userId: socket.userId,
          username: socket.user.username,
          profilePicture: socket.user.profilePicture
        }
      };

      socket.emit('co_host_added', payload);
      this.io.to(streamId).emit('co_host_joined', payload);
      await this.emitParticipantUpdate(streamId, {
        ...liveStream,
        features: {
          ...(liveStream.features || {}),
          collaboration
        }
      });

      const hostSocket = this.userSockets.get(liveStream.hostId);
      if (hostSocket) {
        hostSocket.emit('co_host_accepted', payload);
      }
    } catch (error) {
      console.error('Accept co-host error:', error);
      socket.emit('stream_error', { error: error.message });
    }
  }

  async handleRemoveCoHost(socket, data) {
    try {
      const { streamId, userId } = data;

      const liveStream = await this.getLiveStream(streamId);
      if (!liveStream) {
        return socket.emit('stream_error', { error: 'Stream not found' });
      }

      if (liveStream.hostId !== socket.userId) {
        return socket.emit('stream_error', { error: 'Only the host can remove co-hosts' });
      }

      const collaboration = this.getCollaborationState(liveStream.features);
      collaboration.coHosts = collaboration.coHosts.filter((id) => id !== userId);
      collaboration.pendingCoHostInvites = collaboration.pendingCoHostInvites.filter(
        (invite) => invite.userId !== userId
      );

      await this.saveCollaborationState(liveStream, collaboration);

      const payload = { streamId, userId };
      socket.emit('co_host_removed', payload);
      this.io.to(streamId).emit('co_host_removed', payload);
      await this.emitParticipantUpdate(streamId, {
        ...liveStream,
        features: {
          ...(liveStream.features || {}),
          collaboration
        }
      });

      const targetSocket = this.userSockets.get(userId);
      if (targetSocket) {
        targetSocket.emit('removed_as_co_host', payload);
      }
    } catch (error) {
      console.error('Remove co-host error:', error);
      socket.emit('stream_error', { error: error.message });
    }
  }

  async handleInviteGuest(socket, data) {
    try {
      const { streamId, userId } = data;

      const liveStream = await this.getLiveStream(streamId);
      if (!liveStream) {
        return socket.emit('stream_error', { error: 'Stream not found' });
      }

      if (!this.isHostOrCoHost(socket.userId, liveStream)) {
        return socket.emit('stream_error', { error: 'Only the host or a co-host can invite guests' });
      }

      if (!userId || userId === socket.userId) {
        return socket.emit('stream_error', { error: 'A valid user is required' });
      }

      const targetUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, username: true, profilePicture: true }
      });

      if (!targetUser) {
        return socket.emit('stream_error', { error: 'User not found' });
      }

      const collaboration = this.getCollaborationState(liveStream.features);
      if (collaboration.guests.includes(userId)) {
        return socket.emit('stream_error', { error: 'User is already a guest' });
      }

      const alreadyInvited = collaboration.pendingGuestInvites.some((invite) => invite.userId === userId);
      if (!alreadyInvited) {
        collaboration.pendingGuestInvites.push({
          userId,
          invitedBy: socket.userId,
          invitedAt: new Date().toISOString()
        });

        await this.saveCollaborationState(liveStream, collaboration);
      }

      const targetSocket = this.userSockets.get(userId);
      const payload = {
        streamId,
        invitedBy: {
          userId: socket.userId,
          username: socket.user.username,
          profilePicture: socket.user.profilePicture
        },
        stream: {
          id: liveStream.id,
          _id: liveStream.id,
          title: liveStream.title
        }
      };

      if (targetSocket) {
        targetSocket.emit('guest_invited', payload);
      }

      socket.emit('guest_invite_sent', {
        streamId,
        user: targetUser
      });
    } catch (error) {
      console.error('Invite guest error:', error);
      socket.emit('stream_error', { error: error.message });
    }
  }

  async handleAcceptGuestInvite(socket, data) {
    try {
      const { streamId } = data;

      const liveStream = await this.getLiveStream(streamId);
      if (!liveStream) {
        return socket.emit('stream_error', { error: 'Stream not found' });
      }

      const collaboration = this.getCollaborationState(liveStream.features);
      const hasInvite = collaboration.pendingGuestInvites.some((invite) => invite.userId === socket.userId);

      if (!hasInvite) {
        return socket.emit('stream_error', { error: 'No pending guest invite found' });
      }

      collaboration.pendingGuestInvites = collaboration.pendingGuestInvites.filter(
        (invite) => invite.userId !== socket.userId
      );

      if (!collaboration.guests.includes(socket.userId)) {
        collaboration.guests.push(socket.userId);
      }

      await this.saveCollaborationState(liveStream, collaboration);
      await this.ensureChatMembership(liveStream.chatId, socket.userId);

      const payload = {
        streamId,
        user: {
          userId: socket.userId,
          username: socket.user.username,
          profilePicture: socket.user.profilePicture
        }
      };

      socket.emit('guest_added', payload);
      this.io.to(streamId).emit('guest_joined', payload);
      await this.emitParticipantUpdate(streamId, {
        ...liveStream,
        features: {
          ...(liveStream.features || {}),
          collaboration
        }
      });

      const hostSocket = this.userSockets.get(liveStream.hostId);
      if (hostSocket) {
        hostSocket.emit('guest_accepted', payload);
      }
    } catch (error) {
      console.error('Accept guest invite error:', error);
      socket.emit('stream_error', { error: error.message });
    }
  }

  async handleRemoveGuest(socket, data) {
    try {
      const { streamId, userId } = data;

      const liveStream = await this.getLiveStream(streamId);
      if (!liveStream) {
        return socket.emit('stream_error', { error: 'Stream not found' });
      }

      if (!this.isHostOrCoHost(socket.userId, liveStream)) {
        return socket.emit('stream_error', { error: 'Only the host or a co-host can remove guests' });
      }

      const collaboration = this.getCollaborationState(liveStream.features);
      collaboration.guests = collaboration.guests.filter((id) => id !== userId);
      collaboration.pendingGuestInvites = collaboration.pendingGuestInvites.filter(
        (invite) => invite.userId !== userId
      );

      await this.saveCollaborationState(liveStream, collaboration);

      const payload = { streamId, userId };
      socket.emit('guest_removed', payload);
      this.io.to(streamId).emit('guest_removed', payload);
      await this.emitParticipantUpdate(streamId, {
        ...liveStream,
        features: {
          ...(liveStream.features || {}),
          collaboration
        }
      });

      const targetSocket = this.userSockets.get(userId);
      if (targetSocket) {
        targetSocket.emit('removed_as_guest', payload);
      }
    } catch (error) {
      console.error('Remove guest error:', error);
      socket.emit('stream_error', { error: error.message });
    }
  }
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
