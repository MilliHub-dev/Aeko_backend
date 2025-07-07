/**
 * Enhanced LiveStream Client Library
 * Provides comprehensive livestreaming functionality including WebRTC, chat, reactions, and moderation
 */

class EnhancedLiveStreamClient {
  constructor(options = {}) {
    this.serverUrl = options.serverUrl || 'http://localhost:5000';
    this.socket = null;
    this.token = options.token || null;
    this.userId = options.userId || null;
    this.username = options.username || null;
    
    // WebRTC Configuration
    this.rtcConfig = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        ...options.iceServers || []
      ]
    };
    
    // State management
    this.currentStream = null;
    this.isHost = false;
    this.isViewer = false;
    this.localStream = null;
    this.remoteStreams = new Map();
    this.peerConnections = new Map();
    
    // Event handlers
    this.eventHandlers = new Map();
    
    // Connect on initialization if token provided
    if (this.token) {
      this.connect();
    }
  }

  // === CONNECTION MANAGEMENT ===

  connect() {
    if (this.socket && this.socket.connected) {
      console.warn('Already connected to livestream server');
      return;
    }

    this.socket = io(this.serverUrl + '/livestream', {
      auth: {
        token: this.token
      },
      transports: ['websocket', 'polling']
    });

    this.setupSocketEventHandlers();
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    // Clean up WebRTC connections
    this.cleanupWebRTC();
    
    this.currentStream = null;
    this.isHost = false;
    this.isViewer = false;
  }

  setupSocketEventHandlers() {
    // Connection events
    this.socket.on('connect', () => {
      console.log('✅ Connected to livestream server');
      this.emit('connected');
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Disconnected from livestream server');
      this.emit('disconnected');
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      this.emit('connection_error', error);
    });

    // Stream management events
    this.socket.on('stream_created', (data) => this.emit('stream_created', data));
    this.socket.on('stream_started', (data) => this.emit('stream_started', data));
    this.socket.on('stream_ended', (data) => this.emit('stream_ended', data));
    this.socket.on('stream_joined', (data) => this.handleStreamJoined(data));
    this.socket.on('stream_left', (data) => this.emit('stream_left', data));
    this.socket.on('stream_error', (data) => this.emit('stream_error', data));

    // Viewer management events
    this.socket.on('viewer_joined', (data) => this.emit('viewer_joined', data));
    this.socket.on('viewer_left', (data) => this.emit('viewer_left', data));
    this.socket.on('viewer_count_update', (data) => this.emit('viewer_count_update', data));

    // WebRTC signaling events
    this.socket.on('webrtc_offer', (data) => this.handleWebRTCOffer(data));
    this.socket.on('webrtc_answer', (data) => this.handleWebRTCAnswer(data));
    this.socket.on('ice_candidate', (data) => this.handleICECandidate(data));

    // Chat events
    this.socket.on('stream_chat_message', (data) => this.emit('stream_chat_message', data));
    this.socket.on('stream_chat_typing', (data) => this.emit('stream_chat_typing', data));

    // Reaction events
    this.socket.on('stream_reaction', (data) => this.emit('stream_reaction', data));
    this.socket.on('stream_like', (data) => this.emit('stream_like', data));

    // Monetization events
    this.socket.on('stream_donation', (data) => this.emit('stream_donation', data));
    this.socket.on('donation_received', (data) => this.emit('donation_received', data));
    this.socket.on('donation_sent', (data) => this.emit('donation_sent', data));

    // Moderation events
    this.socket.on('user_banned', (data) => this.emit('user_banned', data));
    this.socket.on('banned_from_stream', (data) => this.emit('banned_from_stream', data));

    // Discovery events
    this.socket.on('trending_streams', (data) => this.emit('trending_streams', data));
    this.socket.on('category_streams', (data) => this.emit('category_streams', data));
    this.socket.on('search_results', (data) => this.emit('search_results', data));
    this.socket.on('new_live_stream', (data) => this.emit('new_live_stream', data));
  }

  // === STREAM MANAGEMENT ===

  async createStream(streamOptions) {
    if (!this.socket || !this.socket.connected) {
      throw new Error('Not connected to livestream server');
    }

    return new Promise((resolve, reject) => {
      this.socket.emit('create_stream', streamOptions);
      
      const timeout = setTimeout(() => {
        reject(new Error('Create stream timeout'));
      }, 10000);

      this.socket.once('stream_created', (data) => {
        clearTimeout(timeout);
        this.currentStream = data.stream;
        this.isHost = true;
        resolve(data);
      });

      this.socket.once('stream_error', (error) => {
        clearTimeout(timeout);
        reject(new Error(error.error));
      });
    });
  }

  async startStream(streamId) {
    if (!this.socket || !this.socket.connected) {
      throw new Error('Not connected to livestream server');
    }

    return new Promise((resolve, reject) => {
      this.socket.emit('start_stream', { streamId });
      
      const timeout = setTimeout(() => {
        reject(new Error('Start stream timeout'));
      }, 10000);

      this.socket.once('stream_started', (data) => {
        clearTimeout(timeout);
        if (this.currentStream) {
          this.currentStream.status = 'live';
          this.currentStream.startedAt = data.startedAt;
        }
        resolve(data);
      });

      this.socket.once('stream_error', (error) => {
        clearTimeout(timeout);
        reject(new Error(error.error));
      });
    });
  }

  async endStream(streamId) {
    if (!this.socket || !this.socket.connected) {
      throw new Error('Not connected to livestream server');
    }

    return new Promise((resolve, reject) => {
      this.socket.emit('end_stream', { streamId });
      
      const timeout = setTimeout(() => {
        reject(new Error('End stream timeout'));
      }, 10000);

      this.socket.once('stream_ended', (data) => {
        clearTimeout(timeout);
        if (this.currentStream) {
          this.currentStream.status = 'ended';
        }
        this.cleanupWebRTC();
        this.isHost = false;
        resolve(data);
      });

      this.socket.once('stream_error', (error) => {
        clearTimeout(timeout);
        reject(new Error(error.error));
      });
    });
  }

  async joinStream(streamId) {
    if (!this.socket || !this.socket.connected) {
      throw new Error('Not connected to livestream server');
    }

    return new Promise((resolve, reject) => {
      this.socket.emit('join_stream', { streamId });
      
      const timeout = setTimeout(() => {
        reject(new Error('Join stream timeout'));
      }, 10000);

      this.socket.once('stream_joined', (data) => {
        clearTimeout(timeout);
        this.currentStream = data.stream;
        this.isViewer = true;
        resolve(data);
      });

      this.socket.once('stream_error', (error) => {
        clearTimeout(timeout);
        reject(new Error(error.error));
      });
    });
  }

  leaveStream(streamId) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('leave_stream', { streamId });
    }
    
    this.cleanupWebRTC();
    this.currentStream = null;
    this.isViewer = false;
  }

  // === WEBRTC MANAGEMENT ===

  async startBroadcast(videoElement, constraints = {}) {
    try {
      // Get user media
      const defaultConstraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      };

      this.localStream = await navigator.mediaDevices.getUserMedia({
        ...defaultConstraints,
        ...constraints
      });

      if (videoElement) {
        videoElement.srcObject = this.localStream;
      }

      this.emit('local_stream_ready', this.localStream);
      return this.localStream;
    } catch (error) {
      console.error('Error starting broadcast:', error);
      this.emit('broadcast_error', error);
      throw error;
    }
  }

  async startScreenShare() {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: true
      });

      // Replace video track in existing peer connections
      if (this.localStream) {
        const videoTrack = screenStream.getVideoTracks()[0];
        const sender = this.peerConnections.forEach(async (pc) => {
          const videoSender = pc.getSenders().find(s => 
            s.track && s.track.kind === 'video'
          );
          if (videoSender) {
            await videoSender.replaceTrack(videoTrack);
          }
        });
      }

      this.emit('screen_share_started', screenStream);
      return screenStream;
    } catch (error) {
      console.error('Error starting screen share:', error);
      this.emit('screen_share_error', error);
      throw error;
    }
  }

  stopScreenShare() {
    // Revert to camera stream
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      this.peerConnections.forEach(async (pc) => {
        const videoSender = pc.getSenders().find(s => 
          s.track && s.track.kind === 'video'
        );
        if (videoSender && videoTrack) {
          await videoSender.replaceTrack(videoTrack);
        }
      });
    }

    this.emit('screen_share_stopped');
  }

  async createPeerConnection(userId) {
    const pc = new RTCPeerConnection(this.rtcConfig);
    
    // Add local stream tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        pc.addTrack(track, this.localStream);
      });
    }

    // Handle remote stream
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      this.remoteStreams.set(userId, remoteStream);
      this.emit('remote_stream_added', { userId, stream: remoteStream });
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit('ice_candidate', {
          streamId: this.currentStream._id,
          candidate: event.candidate,
          targetUserId: userId
        });
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log(`WebRTC connection state for ${userId}:`, pc.connectionState);
      this.emit('connection_state_change', { userId, state: pc.connectionState });
    };

    this.peerConnections.set(userId, pc);
    return pc;
  }

  async handleWebRTCOffer(data) {
    const { streamId, offer, fromUserId } = data;
    
    if (!this.currentStream || this.currentStream._id !== streamId) {
      return;
    }

    const pc = await this.createPeerConnection(fromUserId);
    
    try {
      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      this.socket.emit('answer', {
        streamId,
        answer,
        targetUserId: fromUserId
      });
    } catch (error) {
      console.error('Error handling WebRTC offer:', error);
    }
  }

  async handleWebRTCAnswer(data) {
    const { streamId, answer, fromUserId } = data;
    
    if (!this.currentStream || this.currentStream._id !== streamId) {
      return;
    }

    const pc = this.peerConnections.get(fromUserId);
    if (pc) {
      try {
        await pc.setRemoteDescription(answer);
      } catch (error) {
        console.error('Error handling WebRTC answer:', error);
      }
    }
  }

  async handleICECandidate(data) {
    const { streamId, candidate, fromUserId } = data;
    
    if (!this.currentStream || this.currentStream._id !== streamId) {
      return;
    }

    const pc = this.peerConnections.get(fromUserId);
    if (pc) {
      try {
        await pc.addIceCandidate(candidate);
      } catch (error) {
        console.error('Error adding ICE candidate:', error);
      }
    }
  }

  cleanupWebRTC() {
    // Close all peer connections
    this.peerConnections.forEach(pc => pc.close());
    this.peerConnections.clear();
    
    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    
    // Clear remote streams
    this.remoteStreams.clear();
  }

  // === CHAT FUNCTIONALITY ===

  sendChatMessage(message, replyToId = null) {
    if (!this.socket || !this.currentStream) {
      throw new Error('Not connected to stream');
    }

    this.socket.emit('stream_chat_message', {
      streamId: this.currentStream._id,
      message,
      replyToId
    });
  }

  sendChatTyping() {
    if (!this.socket || !this.currentStream) return;

    this.socket.emit('stream_chat_typing', {
      streamId: this.currentStream._id
    });
  }

  // === REACTIONS AND ENGAGEMENT ===

  sendReaction(emoji) {
    if (!this.socket || !this.currentStream) {
      throw new Error('Not connected to stream');
    }

    this.socket.emit('stream_reaction', {
      streamId: this.currentStream._id,
      emoji
    });
  }

  toggleLike() {
    if (!this.socket || !this.currentStream) {
      throw new Error('Not connected to stream');
    }

    this.socket.emit('stream_like', {
      streamId: this.currentStream._id
    });
  }

  shareStream() {
    if (!this.socket || !this.currentStream) {
      throw new Error('Not connected to stream');
    }

    this.socket.emit('stream_share', {
      streamId: this.currentStream._id
    });
  }

  // === MONETIZATION ===

  sendDonation(amount, message = '', currency = 'USD') {
    if (!this.socket || !this.currentStream) {
      throw new Error('Not connected to stream');
    }

    this.socket.emit('stream_donation', {
      streamId: this.currentStream._id,
      amount,
      message,
      currency
    });
  }

  // === MODERATION ===

  banUser(userId, reason = '') {
    if (!this.socket || !this.currentStream || !this.isHost) {
      throw new Error('Not authorized to ban users');
    }

    this.socket.emit('ban_user', {
      streamId: this.currentStream._id,
      userId,
      reason
    });
  }

  addModerator(userId) {
    if (!this.socket || !this.currentStream || !this.isHost) {
      throw new Error('Not authorized to add moderators');
    }

    this.socket.emit('add_moderator', {
      streamId: this.currentStream._id,
      userId
    });
  }

  // === DISCOVERY ===

  getTrendingStreams(limit = 10) {
    if (!this.socket) {
      throw new Error('Not connected to livestream server');
    }

    this.socket.emit('get_trending_streams', { limit });
  }

  getCategoryStreams(category, limit = 20) {
    if (!this.socket) {
      throw new Error('Not connected to livestream server');
    }

    this.socket.emit('get_category_streams', { category, limit });
  }

  searchStreams(query, filters = {}) {
    if (!this.socket) {
      throw new Error('Not connected to livestream server');
    }

    this.socket.emit('search_streams', { query, filters });
  }

  // === EVENT HANDLING ===

  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(handler);
  }

  off(event, handler) {
    if (this.eventHandlers.has(event)) {
      const handlers = this.eventHandlers.get(event);
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    if (this.eventHandlers.has(event)) {
      this.eventHandlers.get(event).forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  // === UTILITY METHODS ===

  handleStreamJoined(data) {
    this.currentStream = data.stream;
    this.isViewer = true;
    this.emit('stream_joined', data);
  }

  getCurrentStream() {
    return this.currentStream;
  }

  isConnected() {
    return this.socket && this.socket.connected;
  }

  getConnectionState() {
    return {
      connected: this.isConnected(),
      isHost: this.isHost,
      isViewer: this.isViewer,
      currentStream: this.currentStream,
      peerConnections: this.peerConnections.size,
      remoteStreams: this.remoteStreams.size
    };
  }

  // === STREAM QUALITY MANAGEMENT ===

  updateStreamQuality(quality) {
    if (!this.socket || !this.currentStream || !this.isHost) {
      throw new Error('Not authorized to update stream quality');
    }

    this.socket.emit('change_quality', {
      streamId: this.currentStream._id,
      quality
    });
  }

  reportStreamIssue(issueType, description) {
    if (!this.socket || !this.currentStream) {
      throw new Error('Not connected to stream');
    }

    this.socket.emit('report_stream_issue', {
      streamId: this.currentStream._id,
      issueType,
      description
    });
  }

  updateNetworkStats(stats) {
    if (!this.socket || !this.currentStream || !this.isHost) {
      return;
    }

    this.socket.emit('update_network_stats', {
      streamId: this.currentStream._id,
      stats
    });
  }
}

// === UTILITY FUNCTIONS ===

/**
 * Create and configure a video element for stream display
 */
function createVideoElement(options = {}) {
  const video = document.createElement('video');
  video.autoplay = options.autoplay !== false;
  video.muted = options.muted !== false;
  video.playsinline = true;
  video.controls = options.controls || false;
  
  if (options.className) {
    video.className = options.className;
  }
  
  if (options.width) video.width = options.width;
  if (options.height) video.height = options.height;
  
  return video;
}

/**
 * Get available media devices
 */
async function getMediaDevices() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return {
      audioInputs: devices.filter(d => d.kind === 'audioinput'),
      videoInputs: devices.filter(d => d.kind === 'videoinput'),
      audioOutputs: devices.filter(d => d.kind === 'audiooutput')
    };
  } catch (error) {
    console.error('Error getting media devices:', error);
    return { audioInputs: [], videoInputs: [], audioOutputs: [] };
  }
}

/**
 * Check browser WebRTC support
 */
function checkWebRTCSupport() {
  const support = {
    getUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
    RTCPeerConnection: !!window.RTCPeerConnection,
    getDisplayMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia),
    webSockets: !!window.WebSocket
  };
  
  support.isSupported = Object.values(support).every(Boolean);
  return support;
}

/**
 * Format stream duration
 */
function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format viewer count
 */
function formatViewerCount(count) {
  if (count < 1000) return count.toString();
  if (count < 1000000) return `${(count / 1000).toFixed(1)}K`;
  return `${(count / 1000000).toFixed(1)}M`;
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    EnhancedLiveStreamClient,
    createVideoElement,
    getMediaDevices,
    checkWebRTCSupport,
    formatDuration,
    formatViewerCount
  };
}

// Global export for browser
if (typeof window !== 'undefined') {
  window.EnhancedLiveStreamClient = EnhancedLiveStreamClient;
  window.LiveStreamUtils = {
    createVideoElement,
    getMediaDevices,
    checkWebRTCSupport,
    formatDuration,
    formatViewerCount
  };
}