import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Chat from "../models/Chat.js";
import EnhancedMessage from "../models/EnhancedMessage.js";
import enhancedBot from "../ai/enhancedBot.js";
import { generalUpload } from '../middleware/upload.js';
import BlockingMiddleware from "../middleware/blockingMiddleware.js";

const router = express.Router();


// Authentication middleware
const authenticate = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id || decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid token.' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(400).json({ error: 'Invalid token.' });
  }
};

/**
 * @swagger
 * components:
 *   schemas:
 *     EnhancedMessage:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         sender:
 *           type: string
 *         receiver:
 *           type: string
 *         chatId:
 *           type: string
 *         messageType:
 *           type: string
 *           enum: [text, voice, image, video, file, emoji, sticker, ai_response]
 *         content:
 *           type: string
 *         voiceMessage:
 *           type: object
 *           properties:
 *             url:
 *               type: string
 *             duration:
 *               type: number
 *             waveform:
 *               type: array
 *               items:
 *                 type: number
 *         reactions:
 *           type: array
 *         isBot:
 *           type: boolean
 *         status:
 *           type: string
 *         createdAt:
 *           type: string
 *         updatedAt:
 *           type: string
 */

/**
 * @swagger
 * /api/enhanced-chat/conversations:
 *   get:
 *     summary: Get user's conversations
 *     tags: [Enhanced Chat]
 *     description: Retrieve paginated list of user's conversations with unread message counts and last message preview
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Conversations retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/conversations', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const chats = await Chat.find({
      members: req.user._id
    })
    .populate('members', 'username profilePicture lastSeen status')
    .populate({
      path: 'lastMessage',
      model: 'EnhancedMessage',
      populate: {
        path: 'sender',
        select: 'username profilePicture'
      }
    })
    .sort({ updatedAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

    // Get unread count for each chat
    const chatsWithUnread = await Promise.all(
      chats.map(async (chat) => {
        const unreadCount = await EnhancedMessage.countDocuments({
          chatId: chat._id,
          receiver: req.user._id,
          status: { $ne: 'read' },
          deleted: false
        });

        return {
          ...chat.toObject(),
          unreadCount
        };
      })
    );

    res.json({
      success: true,
      conversations: chatsWithUnread,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: chats.length
      }
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/enhanced-chat/messages/{chatId}:
 *   get:
 *     summary: Get messages for a chat
 *     tags: [Enhanced Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: before
 *         schema:
 *           type: string
 *         description: Message ID to load messages before
 *     responses:
 *       200:
 *         description: Messages retrieved successfully
 */
router.get('/messages/:chatId', authenticate, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { page = 1, limit = 50, before } = req.query;
    const skip = (page - 1) * limit;

    // Verify user is member of this chat
    const chat = await Chat.findById(chatId);
    if (!chat || !chat.members.includes(req.user._id)) {
      return res.status(403).json({ error: 'Access denied to this chat' });
    }

    let query = {
      chatId,
      deleted: false
    };

    if (before) {
      const beforeMessage = await EnhancedMessage.findById(before);
      if (beforeMessage) {
        query.createdAt = { $lt: beforeMessage.createdAt };
      }
    }

    const messages = await EnhancedMessage.find(query)
      .populate('sender', 'username profilePicture')
      .populate('receiver', 'username profilePicture')
      .populate({
        path: 'replyTo',
        populate: {
          path: 'sender',
          select: 'username profilePicture'
        }
      })
      .populate('reactions.userId', 'username profilePicture')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      success: true,
      messages: messages.reverse(), // Reverse to show oldest first
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: messages.length === parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/enhanced-chat/send-message:
 *   post:
 *     summary: Send a text message
 *     tags: [Enhanced Chat]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               receiverId:
 *                 type: string
 *               chatId:
 *                 type: string
 *               content:
 *                 type: string
 *               messageType:
 *                 type: string
 *                 enum: [text, emoji]
 *               replyToId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Message sent successfully
 */
router.post('/send-message', authenticate, BlockingMiddleware.checkMessagingAccess(), async (req, res) => {
  try {
    const { receiverId, chatId, content, messageType = 'text', replyToId } = req.body;

    if (!receiverId || !chatId || !content) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const messageData = {
      sender: req.user._id,
      receiver: receiverId,
      chatId,
      content,
      messageType,
      status: 'sent'
    };

    if (replyToId) {
      messageData.replyTo = replyToId;
    }

    const message = new EnhancedMessage(messageData);
    await message.save();

    // Populate sender info
    await message.populate('sender', 'username profilePicture');
    if (replyToId) {
      await message.populate('replyTo', 'content sender');
    }

    // Update chat's last message
    await Chat.findByIdAndUpdate(chatId, {
      lastMessage: message._id,
      updatedAt: new Date()
    });

    res.json({
      success: true,
      message,
      messageId: message._id
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/enhanced-chat/upload-voice:
 *   post:
 *     summary: Upload a voice message
 *     tags: [Enhanced Chat, Voice Messages]
 *     description: Upload recorded voice message with waveform data and automatic duration detection
 *     security:
 *       - bearerAuth: []
 *     consumes:
 *       - multipart/form-data
 *     parameters:
 *       - in: formData
 *         name: voice
 *         type: file
 *         required: true
 *       - in: formData
 *         name: receiverId
 *         type: string
 *         required: true
 *       - in: formData
 *         name: chatId
 *         type: string
 *         required: true
 *       - in: formData
 *         name: duration
 *         type: number
 *         required: true
 *     responses:
 *       200:
 *         description: Voice message uploaded successfully
 */
router.post('/upload-voice', authenticate, generalUpload.single('voice'), async (req, res) => {
  try {
    const { receiverId, chatId, duration, waveform } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'No voice file uploaded' });
    }

    if (!receiverId || !chatId || !duration) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const messageData = {
      sender: req.user._id,
      receiver: receiverId,
      chatId,
      messageType: 'voice',
      voiceMessage: {
        url: req.file.path,
        duration: parseFloat(duration),
        waveform: waveform ? JSON.parse(waveform) : []
      },
      status: 'sent'
    };

    const message = new EnhancedMessage(messageData);
    await message.save();
    await message.populate('sender', 'username profilePicture');

    // Update chat's last message
    await Chat.findByIdAndUpdate(chatId, {
      lastMessage: message._id,
      updatedAt: new Date()
    });

    res.json({
      success: true,
      message,
      voiceUrl: req.file.path
    });
  } catch (error) {
    console.error('Upload voice error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/enhanced-chat/upload-file:
 *   post:
 *     summary: Upload a file/image/video
 *     tags: [Enhanced Chat, File Upload]
 *     description: Upload files up to 100MB with automatic type detection and thumbnail generation
 *     security:
 *       - bearerAuth: []
 *     consumes:
 *       - multipart/form-data
 *     responses:
 *       200:
 *         description: File uploaded successfully
 */
router.post('/upload-file', authenticate, generalUpload.single('file'), async (req, res) => {
  try {
    const { receiverId, chatId, caption } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!receiverId || !chatId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Determine message type based on file
    let messageType = 'file';
    if (req.file.mimetype.startsWith('image/')) {
      messageType = 'image';
    } else if (req.file.mimetype.startsWith('video/')) {
      messageType = 'video';
    } else if (req.file.mimetype.startsWith('audio/')) {
      messageType = 'voice';
    }

    const messageData = {
      sender: req.user._id,
      receiver: receiverId,
      chatId,
      content: caption || '',
      messageType,
      attachments: [{
        type: messageType,
        url: req.file.path,
        filename: req.file.originalname,
        size: req.file.size,
        mimeType: req.file.mimetype
      }],
      status: 'sent'
    };

    const message = new EnhancedMessage(messageData);
    await message.save();
    await message.populate('sender', 'username profilePicture');

    // Update chat's last message
    await Chat.findByIdAndUpdate(chatId, {
      lastMessage: message._id,
      updatedAt: new Date()
    });

    res.json({
      success: true,
      message,
      fileUrl: req.file.path
    });
  } catch (error) {
    console.error('Upload file error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/enhanced-chat/emoji-reactions/{messageId}:
 *   post:
 *     summary: Add emoji reaction to message
 *     tags: [Enhanced Chat, Emoji System]
 *     description: Add emoji reaction to a specific message with real-time synchronization
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               emoji:
 *                 type: string
 *     responses:
 *       200:
 *         description: Reaction added successfully
 */
router.post('/emoji-reactions/:messageId', authenticate, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;

    if (!emoji) {
      return res.status(400).json({ error: 'Emoji is required' });
    }

    const message = await EnhancedMessage.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const result = await message.addReaction(req.user._id, emoji);
    
    if (!result) {
      return res.status(400).json({ error: 'Already reacted with this emoji' });
    }

    res.json({
      success: true,
      message: 'Reaction added successfully',
      reactions: message.reactions
    });
  } catch (error) {
    console.error('Add reaction error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/enhanced-chat/emoji-reactions/{messageId}:
 *   delete:
 *     summary: Remove emoji reaction from message
 *     tags: [Enhanced Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: emoji
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Reaction removed successfully
 */
router.delete('/emoji-reactions/:messageId', authenticate, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.query;

    if (!emoji) {
      return res.status(400).json({ error: 'Emoji is required' });
    }

    const message = await EnhancedMessage.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    await message.removeReaction(req.user._id, emoji);

    res.json({
      success: true,
      message: 'Reaction removed successfully',
      reactions: message.reactions
    });
  } catch (error) {
    console.error('Remove reaction error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/enhanced-chat/bot-chat:
 *   post:
 *     summary: Chat with AI bot
 *     tags: [Enhanced Chat, AI Bot]
 *     description: Send message to AI bot with customizable personality and get intelligent response
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *               chatId:
 *                 type: string
 *               personality:
 *                 type: string
 *                 enum: [friendly, professional, sarcastic, creative, analytical, mentor, companion]
 *               instruction:
 *                 type: string
 *     responses:
 *       200:
 *         description: Bot response generated successfully
 */
router.post('/bot-chat', authenticate, async (req, res) => {
  try {
    const { message, chatId, personality, instruction } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Generate bot response
    const options = {};
    if (personality) options.personalityOverride = personality;
    if (instruction) options.instruction = instruction;

    const botResponse = await enhancedBot.generateResponse(req.user._id, message, options);

    if (botResponse.error) {
      return res.status(500).json({ error: botResponse.error });
    }

    // Save bot message if chatId provided
    let botMessage = null;
    if (chatId) {
      botMessage = new EnhancedMessage({
        sender: req.user._id,
        receiver: req.user._id,
        chatId,
        content: botResponse.response,
        messageType: 'ai_response',
        isBot: true,
        botPersonality: botResponse.personality,
        aiProvider: botResponse.provider,
        confidence: botResponse.confidence,
        status: 'sent'
      });

      await botMessage.save();
    }

    res.json({
      success: true,
      response: botResponse.response,
      botInfo: {
        personality: botResponse.personality,
        provider: botResponse.provider,
        confidence: botResponse.confidence,
        responseTime: botResponse.responseTime
      },
      message: botMessage
    });
  } catch (error) {
    console.error('Bot chat error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/enhanced-chat/create-chat:
 *   post:
 *     summary: Create a new chat
 *     tags: [Enhanced Chat]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               participants:
 *                 type: array
 *                 items:
 *                   type: string
 *               isGroup:
 *                 type: boolean
 *               groupName:
 *                 type: string
 *     responses:
 *       200:
 *         description: Chat created successfully
 */
router.post('/create-chat', authenticate, BlockingMiddleware.checkMessagingAccess(), async (req, res) => {
  try {
    const { participants, isGroup = false, groupName } = req.body;

    if (!participants || participants.length === 0) {
      return res.status(400).json({ error: 'Participants are required' });
    }

    // Add current user to participants if not already included
    const allParticipants = [...new Set([req.user._id.toString(), ...participants])];

    // For direct messages, check if chat already exists
    if (!isGroup && allParticipants.length === 2) {
      const existingChat = await Chat.findOne({
        members: { $all: allParticipants, $size: 2 },
        isGroup: false
      });

      if (existingChat) {
        return res.json({
          success: true,
          chat: existingChat,
          message: 'Chat already exists'
        });
      }
    }

    const chatData = {
      members: allParticipants,
      isGroup,
      groupName: isGroup ? groupName : null
    };

    const chat = new Chat(chatData);
    await chat.save();

    await chat.populate('members', 'username profilePicture lastSeen status');

    res.json({
      success: true,
      chat,
      message: 'Chat created successfully'
    });
  } catch (error) {
    console.error('Create chat error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/enhanced-chat/mark-read/{chatId}:
 *   post:
 *     summary: Mark all messages in chat as read
 *     tags: [Enhanced Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Messages marked as read successfully
 */
router.post('/mark-read/:chatId', authenticate, async (req, res) => {
  try {
    const { chatId } = req.params;

    // Verify user is member of this chat
    const chat = await Chat.findById(chatId);
    if (!chat || !chat.members.includes(req.user._id)) {
      return res.status(403).json({ error: 'Access denied to this chat' });
    }

    await EnhancedMessage.updateMany(
      {
        chatId,
        receiver: req.user._id,
        status: { $ne: 'read' }
      },
      {
        $set: { status: 'read' },
        $push: {
          readBy: {
            userId: req.user._id,
            readAt: new Date()
          }
        }
      }
    );

    res.json({
      success: true,
      message: 'Messages marked as read'
    });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/enhanced-chat/search:
 *   get:
 *     summary: Search messages
 *     tags: [Enhanced Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: chatId
 *         schema:
 *           type: string
 *       - in: query
 *         name: messageType
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Search results
 */
router.get('/search', authenticate, async (req, res) => {
  try {
    const { q, chatId, messageType, limit = 20 } = req.query;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    let query = {
      $or: [
        { sender: req.user._id },
        { receiver: req.user._id }
      ],
      deleted: false,
      content: { $regex: q.trim(), $options: 'i' }
    };

    if (chatId) {
      query.chatId = chatId;
    }

    if (messageType) {
      query.messageType = messageType;
    }

    const messages = await EnhancedMessage.find(query)
      .populate('sender', 'username profilePicture')
      .populate('receiver', 'username profilePicture')
      .populate('chatId', 'isGroup groupName')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      results: messages,
      count: messages.length,
      query: q
    });
  } catch (error) {
    console.error('Search messages error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/enhanced-chat/emoji-list:
 *   get:
 *     summary: Get popular emojis list
 *     tags: [Enhanced Chat, Emoji System]
 *     description: Retrieve categorized list of popular emojis for chat interface
 *     responses:
 *       200:
 *         description: Emoji list retrieved successfully
 */
router.get('/emoji-list', async (req, res) => {
  try {
    const emojiCategories = {
      'smileys': ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳'],
      'animals': ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇'],
      'food': ['🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥒', '🥬', '🌶️', '🌽', '🥕', '🧄', '🧅', '🥔', '🍠', '🥐'],
      'activities': ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛷', '⛸️'],
      'objects': ['⌚', '📱', '📲', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🖲️', '🕹️', '🗜️', '💽', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥', '📽️', '🎞️', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️'],
      'symbols': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐']
    };

    res.json({
      success: true,
      categories: emojiCategories
    });
  } catch (error) {
    console.error('Get emoji list error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Static file serving for uploads
router.get('/uploads/:folder/:filename', (req, res) => {
  const { folder, filename } = req.params;
  const filePath = path.join('uploads', folder, filename);
  
  if (fs.existsSync(filePath)) {
    res.sendFile(path.resolve(filePath));
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

export default router;