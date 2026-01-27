import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import enhancedBot from "../ai/enhancedBot.js";
import { generalUpload } from '../middleware/upload.js';
import BlockingMiddleware from "../middleware/blockingMiddleware.js";

const router = express.Router();
const prisma = new PrismaClient();

// Authentication middleware
const authenticate = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.id || decoded.userId }
    });
    
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

    const chats = await prisma.chat.findMany({
      where: {
        members: {
          some: {
            userId: req.user.id
          }
        }
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                profilePicture: true,
                lastLoginAt: true // approximating lastSeen
              }
            }
          }
        },
        lastMessage: {
          include: {
            sender: {
              select: {
                username: true,
                profilePicture: true
              }
            }
          }
        }
      },
      orderBy: { updatedAt: 'desc' },
      skip: skip,
      take: parseInt(limit)
    });

    // Get unread count for each chat and format members
    const chatsWithUnread = await Promise.all(
      chats.map(async (chat) => {
        const unreadCount = await prisma.enhancedMessage.count({
          where: {
            chatId: chat.id,
            receiverId: req.user.id,
            status: { not: 'read' },
            deleted: false
          }
        });

        // Flatten members to match Mongoose structure (array of users)
        const formattedMembers = chat.members.map(m => ({
            ...m.user,
            _id: m.user.id, // maintain backward compatibility
            lastSeen: m.user.lastLoginAt
        }));

        return {
          ...chat,
          _id: chat.id, // maintain backward compatibility
          members: formattedMembers,
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
        total: chats.length // This is just the fetched count, real total would require another count query
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
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        members: true
      }
    });

    if (!chat || !chat.members.some(m => m.userId === req.user.id)) {
      return res.status(403).json({ error: 'Access denied to this chat' });
    }

    let whereClause = {
      chatId,
      deleted: false
    };

    if (before) {
      const beforeMessage = await prisma.enhancedMessage.findUnique({
        where: { id: before }
      });
      if (beforeMessage) {
        whereClause.createdAt = { lt: beforeMessage.createdAt };
      }
    }

    const messages = await prisma.enhancedMessage.findMany({
      where: whereClause,
      include: {
        sender: {
          select: { username: true, profilePicture: true }
        },
        receiver: {
          select: { username: true, profilePicture: true }
        },
        replyTo: {
          include: {
            sender: {
              select: { username: true, profilePicture: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: skip,
      take: parseInt(limit)
    });

    // Note: 'reactions.userId' population is not directly supported with JSON fields in Prisma.
    // If reactions contain userIds, the frontend will receive them as is.
    // If full user objects are needed, we would need to manually fetch and map them here.

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
      senderId: req.user.id,
      receiverId: receiverId,
      chatId,
      content,
      messageType,
      status: 'sent',
      replyToId: replyToId || null
    };

    const message = await prisma.enhancedMessage.create({
      data: messageData,
      include: {
        sender: {
          select: { username: true, profilePicture: true }
        },
        replyTo: {
          select: { content: true, sender: true }
        }
      }
    });

    // Update chat's last message
    await prisma.chat.update({
      where: { id: chatId },
      data: {
        lastMessageId: message.id,
        updatedAt: new Date()
      }
    });

    res.json({
      success: true,
      message,
      messageId: message.id
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
      senderId: req.user.id,
      receiverId: receiverId,
      chatId,
      messageType: 'voice',
      voiceMessage: {
        url: req.file.path,
        duration: parseFloat(duration),
        waveform: waveform ? JSON.parse(waveform) : []
      },
      status: 'sent'
    };

    const message = await prisma.enhancedMessage.create({
      data: messageData,
      include: {
        sender: {
          select: { username: true, profilePicture: true }
        }
      }
    });

    // Update chat's last message
    await prisma.chat.update({
      where: { id: chatId },
      data: {
        lastMessageId: message.id,
        updatedAt: new Date()
      }
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
      senderId: req.user.id,
      receiverId: receiverId,
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

    const message = await prisma.enhancedMessage.create({
      data: messageData,
      include: {
        sender: {
          select: { username: true, profilePicture: true }
        }
      }
    });

    // Update chat's last message
    await prisma.chat.update({
      where: { id: chatId },
      data: {
        lastMessageId: message.id,
        updatedAt: new Date()
      }
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

    const message = await prisma.enhancedMessage.findUnique({
      where: { id: messageId }
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const reactions = Array.isArray(message.reactions) ? message.reactions : [];
    const exists = reactions.some(r => r.userId === req.user.id && r.emoji === emoji);

    if (exists) {
      return res.status(400).json({ error: 'Already reacted with this emoji' });
    }

    reactions.push({
      userId: req.user.id,
      emoji,
      timestamp: new Date()
    });

    await prisma.enhancedMessage.update({
      where: { id: messageId },
      data: { reactions }
    });

    res.json({
      success: true,
      message: 'Reaction added successfully',
      reactions
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

    const message = await prisma.enhancedMessage.findUnique({
      where: { id: messageId }
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const reactions = Array.isArray(message.reactions) ? message.reactions : [];
    const updatedReactions = reactions.filter(r => !(r.userId === req.user.id && r.emoji === emoji));

    await prisma.enhancedMessage.update({
      where: { id: messageId },
      data: { reactions: updatedReactions }
    });

    res.json({
      success: true,
      message: 'Reaction removed successfully',
      reactions: updatedReactions
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

    const botResponse = await enhancedBot.generateResponse(req.user.id, message, options);

    if (botResponse.error) {
      return res.status(500).json({ error: botResponse.error });
    }

    // Save bot message if chatId provided
    let botMessage = null;
    if (chatId) {
      botMessage = await prisma.enhancedMessage.create({
        data: {
          senderId: req.user.id,
          receiverId: req.user.id,
          chatId,
          content: botResponse.response,
          messageType: 'ai_response',
          isBot: true,
          botPersonality: botResponse.personality,
          aiProvider: botResponse.provider,
          confidence: botResponse.confidence,
          status: 'sent'
        }
      });
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
    const allParticipants = [...new Set([req.user.id.toString(), ...participants])];

    // For direct messages, check if chat already exists
    if (!isGroup && allParticipants.length === 2) {
      const existingChats = await prisma.chat.findMany({
        where: {
          isGroup: false,
          AND: allParticipants.map(id => ({
            members: { some: { userId: id } }
          }))
        },
        include: { members: true }
      });

      const existingChat = existingChats.find(c => c.members.length === 2);

      if (existingChat) {
        return res.json({
          success: true,
          chat: existingChat,
          message: 'Chat already exists'
        });
      }
    }

    const chatData = {
      isGroup,
      groupName: isGroup ? groupName : null,
      members: {
        create: allParticipants.map(id => ({ userId: id }))
      }
    };

    const chat = await prisma.chat.create({
      data: chatData,
      include: {
        members: {
          include: {
            user: {
              select: { username: true, profilePicture: true, lastLoginAt: true }
            }
          }
        }
      }
    });

    // Flatten members to match Mongoose structure
    const formattedMembers = chat.members.map(m => ({
        ...m.user,
        _id: m.user.id || m.userId,
        lastSeen: m.user.lastLoginAt
    }));

    const formattedChat = {
        ...chat,
        members: formattedMembers
    };

    res.json({
      success: true,
      chat: formattedChat,
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
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: { members: true }
    });

    if (!chat || !chat.members.some(m => m.userId === req.user.id)) {
      return res.status(403).json({ error: 'Access denied to this chat' });
    }

    // Update status to read
    // Note: Pushing to readBy array in updateMany is not supported in Prisma directly.
    // We update the status to 'read'.
    await prisma.enhancedMessage.updateMany({
      where: {
        chatId,
        receiverId: req.user.id,
        status: { not: 'read' }
      },
      data: {
        status: 'read'
      }
    });

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

    let whereClause = {
      OR: [
        { senderId: req.user.id },
        { receiverId: req.user.id }
      ],
      deleted: false,
      content: { contains: q.trim(), mode: 'insensitive' }
    };

    if (chatId) {
      whereClause.chatId = chatId;
    }

    if (messageType) {
      whereClause.messageType = messageType;
    }

    const messages = await prisma.enhancedMessage.findMany({
      where: whereClause,
      include: {
        sender: { select: { username: true, profilePicture: true } },
        receiver: { select: { username: true, profilePicture: true } },
        chat: { select: { isGroup: true, groupName: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit)
    });

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
