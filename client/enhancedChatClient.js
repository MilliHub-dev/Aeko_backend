import io from 'socket.io-client';

class EnhancedChatClient {
  constructor(serverUrl = 'http://localhost:5000', token = null) {
    this.serverUrl = serverUrl;
    this.token = token;
    this.socket = null;
    this.isConnected = false;
    this.currentChatId = null;
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.isRecording = false;
    
    // Event handlers
    this.eventHandlers = {
      onNewMessage: null,
      onBotResponse: null,
      onVoiceMessage: null,
      onReactionAdded: null,
      onUserTyping: null,
      onUserOnline: null,
      onError: null
    };
    
    this.init();
  }

  // Initialize Socket.IO connection
  init() {
    if (!this.token) {
      console.error('No authentication token provided');
      return;
    }

    this.socket = io(this.serverUrl, {
      auth: {
        token: this.token
      },
      transports: ['websocket', 'polling']
    });

    this.setupEventListeners();
  }

  // Setup Socket.IO event listeners
  setupEventListeners() {
    // Connection events
    this.socket.on('connect', () => {
      console.log('✅ Connected to Enhanced Chat Server');
      this.isConnected = true;
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Disconnected from Enhanced Chat Server');
      this.isConnected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error.message);
      if (this.eventHandlers.onError) {
        this.eventHandlers.onError({ type: 'connection', error: error.message });
      }
    });

    // Message events
    this.socket.on('new_message', (data) => {
      console.log('📨 New message received:', data);
      if (this.eventHandlers.onNewMessage) {
        this.eventHandlers.onNewMessage(data);
      }
    });

    this.socket.on('new_voice_message', (data) => {
      console.log('🎵 New voice message received:', data);
      if (this.eventHandlers.onVoiceMessage) {
        this.eventHandlers.onVoiceMessage(data);
      }
    });

    // Bot events
    this.socket.on('bot_response', (data) => {
      console.log('🤖 Bot response received:', data);
      if (this.eventHandlers.onBotResponse) {
        this.eventHandlers.onBotResponse(data);
      }
    });

    this.socket.on('bot_auto_reply', (data) => {
      console.log('🤖 Bot auto-reply received:', data);
      if (this.eventHandlers.onBotResponse) {
        this.eventHandlers.onBotResponse(data);
      }
    });

    // Reaction events
    this.socket.on('reaction_added', (data) => {
      console.log('😊 Reaction added:', data);
      if (this.eventHandlers.onReactionAdded) {
        this.eventHandlers.onReactionAdded(data);
      }
    });

    this.socket.on('reaction_removed', (data) => {
      console.log('😔 Reaction removed:', data);
      if (this.eventHandlers.onReactionAdded) {
        this.eventHandlers.onReactionAdded({...data, removed: true});
      }
    });

    // Typing events
    this.socket.on('user_typing', (data) => {
      if (this.eventHandlers.onUserTyping) {
        this.eventHandlers.onUserTyping(data);
      }
    });

    // Status events
    this.socket.on('user_status_update', (data) => {
      if (this.eventHandlers.onUserOnline) {
        this.eventHandlers.onUserOnline(data);
      }
    });

    // Voice recording events
    this.socket.on('user_recording_voice', (data) => {
      console.log('🎙️ User recording voice:', data);
    });

    // Read receipts
    this.socket.on('message_read', (data) => {
      console.log('👁️ Message read:', data);
    });

    // Confirmation events
    this.socket.on('message_sent', (data) => {
      console.log('✅ Message sent confirmation:', data);
    });

    this.socket.on('voice_message_sent', (data) => {
      console.log('✅ Voice message sent confirmation:', data);
    });

    // Error events
    this.socket.on('message_error', (error) => {
      console.error('Message error:', error);
      if (this.eventHandlers.onError) {
        this.eventHandlers.onError({ type: 'message', error: error.error });
      }
    });

    this.socket.on('bot_error', (error) => {
      console.error('Bot error:', error);
      if (this.eventHandlers.onError) {
        this.eventHandlers.onError({ type: 'bot', error: error.error });
      }
    });
  }

  // === CHAT METHODS ===

  // Join a chat room
  joinChat(chatId) {
    this.currentChatId = chatId;
    this.socket.emit('join_chat', { chatId });
    console.log(`Joining chat: ${chatId}`);
  }

  // Send a text message
  sendMessage(receiverId, content, options = {}) {
    if (!this.isConnected) {
      console.error('Not connected to server');
      return;
    }

    const messageData = {
      receiverId,
      chatId: this.currentChatId,
      content,
      messageType: options.messageType || 'text',
      replyToId: options.replyToId,
      metadata: options.metadata
    };

    this.socket.emit('send_message', messageData);
  }

  // Send an emoji
  sendEmoji(receiverId, emoji, skinTone = null) {
    if (!this.isConnected) {
      console.error('Not connected to server');
      return;
    }

    this.socket.emit('send_emoji', {
      receiverId,
      chatId: this.currentChatId,
      emoji,
      skinTone
    });
  }

  // === VOICE RECORDING METHODS ===

  // Start voice recording
  async startVoiceRecording() {
    try {
      if (this.isRecording) {
        console.warn('Already recording');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });

      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm; codecs=opus'
      });

      this.recordedChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.processRecordedAudio();
      };

      this.mediaRecorder.start(1000); // Collect data every second
      this.isRecording = true;

      // Notify server about recording start
      this.socket.emit('start_voice_recording', {
        chatId: this.currentChatId
      });

      console.log('🎙️ Voice recording started');
      return true;
    } catch (error) {
      console.error('Error starting voice recording:', error);
      if (this.eventHandlers.onError) {
        this.eventHandlers.onError({ type: 'voice_recording', error: error.message });
      }
      return false;
    }
  }

  // Stop voice recording
  stopVoiceRecording() {
    if (!this.isRecording || !this.mediaRecorder) {
      console.warn('Not currently recording');
      return;
    }

    this.mediaRecorder.stop();
    this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
    this.isRecording = false;

    // Notify server about recording stop
    this.socket.emit('stop_voice_recording', {
      chatId: this.currentChatId
    });

    console.log('🛑 Voice recording stopped');
  }

  // Process recorded audio
  async processRecordedAudio() {
    if (this.recordedChunks.length === 0) {
      console.warn('No audio data recorded');
      return;
    }

    const audioBlob = new Blob(this.recordedChunks, { type: 'audio/webm' });
    const duration = await this.getAudioDuration(audioBlob);
    const waveform = await this.generateWaveform(audioBlob);

    // Convert to base64 for sending
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Audio = reader.result;
      
      this.socket.emit('send_voice_message', {
        receiverId: this.currentReceiverId,
        chatId: this.currentChatId,
        voiceData: base64Audio,
        duration,
        waveform
      });
    };

    reader.readAsDataURL(audioBlob);
    console.log(`🎵 Processed voice message: ${duration}s`);
  }

  // Get audio duration
  getAudioDuration(audioBlob) {
    return new Promise((resolve) => {
      const audio = new Audio();
      audio.onloadedmetadata = () => {
        resolve(audio.duration);
      };
      audio.src = URL.createObjectURL(audioBlob);
    });
  }

  // Generate simple waveform data
  async generateWaveform(audioBlob) {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      const channelData = audioBuffer.getChannelData(0);
      const sampleStep = Math.floor(channelData.length / 100); // 100 points
      const waveform = [];
      
      for (let i = 0; i < channelData.length; i += sampleStep) {
        waveform.push(Math.abs(channelData[i]));
      }
      
      return waveform;
    } catch (error) {
      console.error('Error generating waveform:', error);
      return [];
    }
  }

  // === REACTION METHODS ===

  // Add emoji reaction to message
  addReaction(messageId, emoji) {
    this.socket.emit('add_reaction', { messageId, emoji });
  }

  // Remove emoji reaction from message
  removeReaction(messageId, emoji) {
    this.socket.emit('remove_reaction', { messageId, emoji });
  }

  // === AI BOT METHODS ===

  // Chat with AI bot
  chatWithBot(message, options = {}) {
    this.socket.emit('chat_with_bot', {
      message,
      chatId: this.currentChatId,
      personality: options.personality,
      instruction: options.instruction
    });
  }

  // === TYPING INDICATORS ===

  // Start typing indicator
  startTyping(receiverId) {
    this.socket.emit('typing_start', {
      chatId: this.currentChatId,
      receiverId
    });
  }

  // Stop typing indicator
  stopTyping(receiverId) {
    this.socket.emit('typing_stop', {
      chatId: this.currentChatId,
      receiverId
    });
  }

  // === UTILITY METHODS ===

  // Mark message as read
  markMessageAsRead(messageId) {
    this.socket.emit('mark_message_read', { messageId });
  }

  // Set current receiver (for voice messages)
  setCurrentReceiver(receiverId) {
    this.currentReceiverId = receiverId;
  }

  // === EVENT HANDLERS ===

  // Set event handler
  on(event, handler) {
    if (this.eventHandlers.hasOwnProperty(`on${event.charAt(0).toUpperCase()}${event.slice(1)}`)) {
      this.eventHandlers[`on${event.charAt(0).toUpperCase()}${event.slice(1)}`] = handler;
    } else {
      console.warn(`Unknown event: ${event}`);
    }
  }

  // === CONNECTION MANAGEMENT ===

  // Disconnect from server
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.isConnected = false;
      console.log('Disconnected from Enhanced Chat Server');
    }
  }

  // Reconnect to server
  reconnect() {
    if (this.socket) {
      this.socket.connect();
    }
  }

  // Get connection status
  getConnectionStatus() {
    return {
      connected: this.isConnected,
      socketId: this.socket?.id,
      currentChatId: this.currentChatId,
      isRecording: this.isRecording
    };
  }
}

// === EMOJI UTILITIES ===

export const EmojiUtils = {
  // Popular emoji categories
  categories: {
    smileys: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳'],
    hearts: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟'],
    gestures: ['👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '🤏', '👈', '👉', '👆', '👇', '☝️', '✋', '🤚', '🖐️', '🖖', '👋', '🤝'],
    activities: ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳']
  },

  // Get emoji by category
  getByCategory(category) {
    return this.categories[category] || [];
  },

  // Get all emojis
  getAllEmojis() {
    return Object.values(this.categories).flat();
  },

  // Search emojis by keyword
  searchEmojis(keyword) {
    const emojiMap = {
      'happy': ['😀', '😃', '😄', '😁', '😊', '🙂', '😌'],
      'love': ['❤️', '💕', '💖', '💗', '💘', '💝', '😍', '🥰'],
      'sad': ['😢', '😭', '😔', '😞', '😒', '😕', '🙁'],
      'angry': ['😠', '😡', '🤬', '😤', '💢'],
      'funny': ['😂', '🤣', '😆', '😅', '🤪', '😜', '😝'],
      'thumbs': ['👍', '👎'],
      'fire': ['🔥'],
      'star': ['⭐', '🌟', '✨'],
      'party': ['🎉', '🎊', '🥳', '🎈'],
      'food': ['🍕', '🍔', '🍟', '🌭', '🥪', '🌮', '🌯']
    };

    const keyword_lower = keyword.toLowerCase();
    return emojiMap[keyword_lower] || [];
  }
};

// === VOICE RECORDING UTILITIES ===

export const VoiceUtils = {
  // Check if voice recording is supported
  isSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  },

  // Get audio constraints for different quality levels
  getAudioConstraints(quality = 'standard') {
    const constraints = {
      low: {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 22050,
          channelCount: 1
        }
      },
      standard: {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
          channelCount: 1
        }
      },
      high: {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 48000,
          channelCount: 2
        }
      }
    };

    return constraints[quality] || constraints.standard;
  },

  // Format duration for display
  formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
};

export default EnhancedChatClient;