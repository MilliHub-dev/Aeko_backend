import jwt from "jsonwebtoken";
import { prisma } from "../config/db.js";
import enhancedBot from "../ai/enhancedBot.js";
import { sendPushNotification } from "../services/notificationService.js";
import multer from "multer";
import path from "path";
import fs from "fs";

class EnhancedChatSocket {
  constructor(io) {
    this.io = io;

    this.connectedUsers = new Map();
    this.typingUsers = new Map();
    this.voiceRooms = new Map();
    
    this.setupSocket();
    this.setupFileUpload();
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
        const user = await prisma.user.findUnique({
          where: { id: decoded.id || decoded.userId }
        });
        
        if (!user) {
          return next(new Error('Authentication error: User not found'));
        }

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

  setupFileUpload() {
    // Configure multer for voice and file uploads
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        const uploadPath = `uploads/${file.fieldname}s/`;
        if (!fs.existsSync(uploadPath)) {
          fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
      }
    });

    this.upload = multer({
      storage,
      limits: {
        fileSize: 100 * 1024 * 1024, // 100MB limit
      },
      fileFilter: (req, file, cb) => {
        // Allow voice files, images, videos, and documents
        const allowedTypes = /jpeg|jpg|png|gif|mp4|mov|avi|mp3|wav|ogg|m4a|pdf|doc|docx|txt/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
          return cb(null, true);
        } else {
          cb(new Error('Invalid file type'));
        }
      }
    });
  }

  handleConnection(socket) {
    console.log(`✅ User connected: ${socket.user.username} (${socket.userId})`);
    
    // Store user connection
    this.connectedUsers.set(socket.userId, {
      socketId: socket.id,
      user: socket.user,
      lastSeen: new Date(),
      status: 'online'
    });

    // Join user to their personal room
    socket.join(socket.userId);

    // Notify user's contacts about online status
    this.broadcastUserStatus(socket.userId, 'online');

    // Send user their unread message count
    this.sendUnreadCount(socket);

    // Register event handlers
    this.registerEventHandlers(socket);

    socket.on('disconnect', () => {
      this.handleDisconnection(socket);
    });
  }

  registerEventHandlers(socket) {
    // === BASIC MESSAGING ===
    socket.on('join_chat', (data) => this.handleJoinChat(socket, data));
    socket.on('send_message', (data) => this.handleSendMessage(socket, data));
    socket.on('send_emoji', (data) => this.handleSendEmoji(socket, data));
    
    // === VOICE MESSAGES ===
    socket.on('send_voice_message', (data) => this.handleSendVoiceMessage(socket, data));
    socket.on('start_voice_recording', (data) => this.handleStartVoiceRecording(socket, data));
    socket.on('stop_voice_recording', (data) => this.handleStopVoiceRecording(socket, data));
    
    // === AI BOT INTEGRATION ===
    socket.on('chat_with_bot', (data) => this.handleChatWithBot(socket, data));
    socket.on('enable_bot_in_chat', (data) => this.handleEnableBotInChat(socket, data));
    
    // === MESSAGE INTERACTIONS ===
    socket.on('add_reaction', (data) => this.handleAddReaction(socket, data));
    socket.on('remove_reaction', (data) => this.handleRemoveReaction(socket, data));
    socket.on('mark_message_read', (data) => this.handleMarkMessageRead(socket, data));
    socket.on('edit_message', (data) => this.handleEditMessage(socket, data));
    socket.on('delete_message', (data) => this.handleDeleteMessage(socket, data));
    socket.on('reply_to_message', (data) => this.handleReplyToMessage(socket, data));
    
    // === TYPING INDICATORS ===
    socket.on('typing_start', (data) => this.handleTypingStart(socket, data));
    socket.on('typing_stop', (data) => this.handleTypingStop(socket, data));
    
    // === FILE SHARING ===
    socket.on('upload_file', (data) => this.handleFileUpload(socket, data));
    socket.on('share_location', (data) => this.handleShareLocation(socket, data));
    
    // === CHAT MANAGEMENT ===
    socket.on('create_group_chat', (data) => this.handleCreateGroupChat(socket, data));
    socket.on('get_chat_history', (data) => this.handleGetChatHistory(socket, data));
    socket.on('search_messages', (data) => this.handleSearchMessages(socket, data));
  }

  // === MESSAGE HANDLING ===
  async handleSendMessage(socket, data) {
    try {
      const { receiverId, chatId, content, messageType = 'text', replyToId, metadata } = data;

      const messageData = {
        senderId: socket.userId,
        receiverId,
        chatId,
        content,
        messageType,
        status: 'sent',
        metadata: {
          ...metadata,
          deviceType: socket.handshake.headers['user-agent']?.includes('Mobile') ? 'mobile' : 'web',
          clientId: data.clientId
        },
        replyToId: replyToId || null
      };

      const message = await prisma.enhancedMessage.create({
        data: messageData,
        include: {
          sender: {
            select: {
            id: true,
            name: true,
            username: true,
            profilePicture: true,
            avatar: true,
            blueTick: true,
            goldenTick: true
          }
          },
          replyTo: replyToId
            ? {
                select: {
                  content: true,
                  sender: true
                }
              }
            : false
        }
      });

      // Send to receiver
      this.io.to(receiverId).emit('new_message', {
        message,
        chatId,
        sender: {
          id: socket.userId,
          name: socket.user.name,
          username: socket.user.username,
          profilePicture: socket.user.profilePicture,
          avatar: socket.user.avatar,
          blueTick: socket.user.blueTick,
          goldenTick: socket.user.goldenTick
        }
      });

      // Send confirmation to sender
      socket.emit('message_sent', {
        messageId: message.id,
        status: 'sent',
        timestamp: message.createdAt
      });

      // Check if receiver has bot enabled for auto-reply
      await this.checkAndTriggerBotResponse(receiverId, content, chatId, socket.userId);

      // Send Push Notification
      try {
        await sendPushNotification(receiverId, {
          type: 'MESSAGE',
          title: `New message from ${socket.user.name || socket.user.username}`,
          message: content.substring(0, 100),
          entityId: message.id,
          entityType: 'MESSAGE',
          metadata: {
              chatId,
              senderId: socket.userId
          }
        });
      } catch (err) {
        console.error('Error sending chat push notification:', err);
      }

      // Update chat's last message
      await this.updateChatLastMessage(chatId, message.id);

    } catch (error) {
      console.error('Send message error:', error);
      socket.emit('message_error', { error: error.message });
    }
  }

  async handleSendEmoji(socket, data) {
    try {
      const { receiverId, chatId, emoji, skinTone } = data;

      const emojiContent = skinTone ? `${emoji}${skinTone}` : emoji;

      await this.handleSendMessage(socket, {
        receiverId,
        chatId,
        content: emojiContent,
        messageType: 'emoji'
      });

    } catch (error) {
      console.error('Send emoji error:', error);
      socket.emit('emoji_error', { error: error.message });
    }
  }

  // === VOICE MESSAGE HANDLING ===
  async handleSendVoiceMessage(socket, data) {
    try {
      const { receiverId, chatId, voiceData, duration, waveform } = data;

      // Save voice file (in production, you'd upload to cloud storage)
      const voiceFilename = `voice-${Date.now()}-${socket.userId}.wav`;
      const voicePath = `uploads/voice/${voiceFilename}`;
      
      // Ensure directory exists
      if (!fs.existsSync('uploads/voice/')) {
        fs.mkdirSync('uploads/voice/', { recursive: true });
      }

      // Save voice data (assuming base64)
      const voiceBuffer = Buffer.from(voiceData.split(',')[1], 'base64');
      fs.writeFileSync(voicePath, voiceBuffer);

      const message = await prisma.enhancedMessage.create({
        data: {
          senderId: socket.userId,
          receiverId,
          chatId,
          messageType: 'voice',
          voiceMessage: {
            url: voicePath,
            duration,
            waveform: waveform || []
          },
          status: 'sent'
        },
        include: {
          sender: {
            select: {
            id: true,
            name: true,
            username: true,
            profilePicture: true,
            avatar: true,
            blueTick: true,
            goldenTick: true
          }
          }
        }
      });

      // Send to receiver
      this.io.to(receiverId).emit('new_voice_message', {
        message,
        chatId,
        sender: {
          id: socket.userId,
          name: socket.user.name,
          username: socket.user.username,
          profilePicture: socket.user.profilePicture,
          avatar: socket.user.avatar,
          blueTick: socket.user.blueTick,
          goldenTick: socket.user.goldenTick
        }
      });

      // Send confirmation to sender
      socket.emit('voice_message_sent', {
        messageId: message.id,
        status: 'sent'
      });

      // Update chat's last message
      await this.updateChatLastMessage(chatId, message.id);

    } catch (error) {
      console.error('Send voice message error:', error);
      socket.emit('voice_message_error', { error: error.message });
    }
  }

  handleStartVoiceRecording(socket, data) {
    const { chatId } = data;
    
    // Notify other participants that user started recording
    socket.to(chatId).emit('user_recording_voice', {
      userId: socket.userId,
      username: socket.user.username,
      recording: true
    });

    socket.emit('recording_started', { chatId });
  }

  handleStopVoiceRecording(socket, data) {
    const { chatId } = data;
    
    // Notify other participants that user stopped recording
    socket.to(chatId).emit('user_recording_voice', {
      userId: socket.userId,
      username: socket.user.username,
      recording: false
    });

    socket.emit('recording_stopped', { chatId });
  }

  // === AI BOT INTEGRATION ===
  async handleChatWithBot(socket, data) {
    try {
      const { message, chatId, personality, instruction } = data;

      // Generate bot response
      const options = {};
      if (personality) options.personalityOverride = personality;
      if (instruction) options.instruction = instruction;

      const botResponse = await enhancedBot.generateResponse(socket.userId, message, options);

      if (botResponse.error) {
        socket.emit('bot_error', { error: botResponse.error });
        return;
      }

      const botMessage = await prisma.enhancedMessage.create({
        data: {
          senderId: socket.userId,
          receiverId: socket.userId,
          chatId,
          content: botResponse.response,
          messageType: 'ai_response',
          isBot: true,
          botPersonality: botResponse.personality,
          aiProvider: botResponse.provider,
          confidence: botResponse.confidence,
          status: 'sent'
        },
        include: {
          sender: {
            select: {
            id: true,
            name: true,
            username: true,
            profilePicture: true,
            avatar: true,
            blueTick: true,
            goldenTick: true
          }
          }
        }
      });

      // Send bot response to user
      socket.emit('bot_response', {
        message: botMessage,
        chatId,
        botInfo: {
          personality: botResponse.personality,
          provider: botResponse.provider,
          confidence: botResponse.confidence,
          responseTime: botResponse.responseTime
        }
      });

    } catch (error) {
      console.error('Chat with bot error:', error);
      socket.emit('bot_error', { error: error.message });
    }
  }

  async checkAndTriggerBotResponse(receiverId, userMessage, chatId, senderId) {
    try {
      const receiver = await prisma.user.findUnique({
        where: { id: receiverId }
      });
      
      if (receiver && receiver.botEnabled) {
        // Generate bot auto-reply
        const botResponse = await enhancedBot.generateResponse(receiverId, userMessage);
        
        if (botResponse && !botResponse.error) {
          const botMessage = await prisma.enhancedMessage.create({
            data: {
              senderId: receiverId,
              receiverId: senderId,
              chatId,
              content: botResponse.response,
              messageType: 'ai_response',
              isBot: true,
              botPersonality: botResponse.personality,
              aiProvider: botResponse.provider,
              confidence: botResponse.confidence,
              status: 'sent'
            },
            include: {
              sender: {
                select: {
            id: true,
            name: true,
            username: true,
            profilePicture: true,
            avatar: true,
            blueTick: true,
            goldenTick: true
          }
              }
            }
          });

          // Update chat's last message
          await this.updateChatLastMessage(chatId, botMessage.id);

          // Send bot response to original sender
          this.io.to(senderId).emit('bot_auto_reply', {
            message: botMessage,
            chatId,
            botInfo: {
              personality: botResponse.personality,
              provider: botResponse.provider,
              confidence: botResponse.confidence
            }
          });

          // Also send to receiver if they're online
          if (this.connectedUsers.has(receiverId)) {
            this.io.to(receiverId).emit('bot_sent_reply', {
              message: botMessage,
              chatId,
              toUser: senderId
            });
          }
        }
      }
    } catch (error) {
      console.error('Bot auto-reply error:', error);
    }
  }

  // === REACTIONS ===
  async handleAddReaction(socket, data) {
    try {
      const { messageId, emoji } = data;

      const message = await prisma.enhancedMessage.findUnique({
        where: { id: messageId },
        select: { chatId: true, reactions: true }
      });
      if (!message) {
        socket.emit('reaction_error', { error: 'Message not found' });
        return;
      }

      const reactions = Array.isArray(message.reactions) ? message.reactions : [];
      const exists = reactions.some(
        (r) => r.userId === socket.userId && r.emoji === emoji
      );

      if (!exists) {
        reactions.push({
          userId: socket.userId,
          emoji,
          timestamp: new Date().toISOString()
        });

        await prisma.enhancedMessage.update({
          where: { id: messageId },
          data: { reactions }
        });
      }

      // Notify all participants in the chat
      this.io.to(message.chatId).emit('reaction_added', {
        messageId,
        userId: socket.userId,
        username: socket.user.username,
        emoji,
        timestamp: new Date()
      });

    } catch (error) {
      console.error('Add reaction error:', error);
      socket.emit('reaction_error', { error: error.message });
    }
  }

  async handleRemoveReaction(socket, data) {
    try {
      const { messageId, emoji } = data;

      const message = await prisma.enhancedMessage.findUnique({
        where: { id: messageId },
        select: { chatId: true, reactions: true }
      });
      if (!message) {
        socket.emit('reaction_error', { error: 'Message not found' });
        return;
      }

      const reactions = Array.isArray(message.reactions) ? message.reactions : [];
      const filtered = reactions.filter(
        (r) => !(r.userId === socket.userId && r.emoji === emoji)
      );

      if (filtered.length !== reactions.length) {
        await prisma.enhancedMessage.update({
          where: { id: messageId },
          data: { reactions: filtered }
        });
      }

      // Notify all participants in the chat
      this.io.to(message.chatId).emit('reaction_removed', {
        messageId,
        userId: socket.userId,
        emoji
      });

    } catch (error) {
      console.error('Remove reaction error:', error);
      socket.emit('reaction_error', { error: error.message });
    }
  }

  // === TYPING INDICATORS ===
  handleTypingStart(socket, data) {
    const { chatId, receiverId } = data;
    
    const typingKey = `${chatId}-${socket.userId}`;
    this.typingUsers.set(typingKey, {
      userId: socket.userId,
      username: socket.user.username,
      chatId,
      timestamp: Date.now()
    });

    // Notify receiver
    if (receiverId) {
      this.io.to(receiverId).emit('user_typing', {
        userId: socket.userId,
        username: socket.user.username,
        chatId,
        typing: true
      });
    }

    // Auto-stop typing after 3 seconds
    setTimeout(() => {
      if (this.typingUsers.has(typingKey)) {
        this.handleTypingStop(socket, data);
      }
    }, 3000);
  }

  handleTypingStop(socket, data) {
    const { chatId, receiverId } = data;
    
    const typingKey = `${chatId}-${socket.userId}`;
    this.typingUsers.delete(typingKey);

    // Notify receiver
    if (receiverId) {
      this.io.to(receiverId).emit('user_typing', {
        userId: socket.userId,
        username: socket.user.username,
        chatId,
        typing: false
      });
    }
  }

  // === UTILITY METHODS ===
  async handleJoinChat(socket, data) {
    const { chatId } = data;
    socket.join(chatId);
    
    socket.emit('joined_chat', { 
      chatId, 
      message: `Joined chat ${chatId}`,
      onlineUsers: this.getOnlineUsersInChat(chatId)
    });
  }

  async handleMarkMessageRead(socket, data) {
    try {
      const { messageId } = data;

      const message = await prisma.enhancedMessage.findUnique({
        where: { id: messageId },
        select: { senderId: true, readBy: true }
      });
      if (message) {
        const readBy = Array.isArray(message.readBy) ? message.readBy : [];
        const exists = readBy.some((r) => r.userId === socket.userId);

        if (!exists) {
          readBy.push({
            userId: socket.userId,
            readAt: new Date().toISOString()
          });

          await prisma.enhancedMessage.update({
            where: { id: messageId },
            data: {
              readBy,
              status: "read"
            }
          });
        }

        this.io.to(message.senderId).emit("message_read", {
          messageId,
          readBy: socket.userId,
          readAt: new Date()
        });
      }
    } catch (error) {
      console.error('Mark message read error:', error);
    }
  }

  async sendUnreadCount(socket) {
    try {
      const unreadCount = await prisma.enhancedMessage.count({
        where: {
          receiverId: socket.userId,
          NOT: { status: "read" },
          deleted: false
        }
      });

      socket.emit('unread_count', { count: unreadCount });
    } catch (error) {
      console.error('Send unread count error:', error);
    }
  }

  async updateChatLastMessage(chatId, messageId) {
    try {
      await prisma.chat.update({
        where: { id: chatId },
        data: {
          lastMessageId: messageId,
          updatedAt: new Date()
        }
      });
    } catch (error) {
      console.error('Update chat last message error:', error);
    }
  }

  broadcastUserStatus(userId, status) {
    this.io.emit('user_status_update', {
      userId,
      status,
      timestamp: new Date()
    });
  }

  getOnlineUsersInChat(chatId) {
    const room = this.io.sockets.adapter.rooms.get(chatId);
    if (!room) return [];

    const onlineUsers = [];
    for (const socketId of room) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket && socket.userId) {
        const userInfo = this.connectedUsers.get(socket.userId);
        if (userInfo) {
          onlineUsers.push({
            userId: socket.userId,
            username: userInfo.user.username,
            status: userInfo.status
          });
        }
      }
    }
    return onlineUsers;
  }

  handleDisconnection(socket) {
    console.log(`❌ User disconnected: ${socket.user?.username} (${socket.userId})`);
    
    // Update user status
    if (this.connectedUsers.has(socket.userId)) {
      this.connectedUsers.get(socket.userId).status = 'offline';
      this.connectedUsers.get(socket.userId).lastSeen = new Date();
    }

    // Clean up typing indicators
    for (const [key, value] of this.typingUsers) {
      if (value.userId === socket.userId) {
        this.typingUsers.delete(key);
      }
    }

    // Notify contacts about offline status
    this.broadcastUserStatus(socket.userId, 'offline');
  }

  // === PUBLIC METHODS ===
  getConnectedUsers() {
    return Array.from(this.connectedUsers.values());
  }

  getTypingUsers(chatId) {
    const typing = [];
    for (const [key, value] of this.typingUsers) {
      if (value.chatId === chatId) {
        typing.push(value);
      }
    }
    return typing;
  }

  isUserOnline(userId) {
    return this.connectedUsers.has(userId) && 
           this.connectedUsers.get(userId).status === 'online';
  }
}

export default EnhancedChatSocket;
