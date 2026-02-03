import express from "express";
import { prisma } from "../config/db.js";
import { v4 as uuidv4 } from "uuid";
import authMiddleware from "../middleware/authMiddleware.js";
import getBotResponse from "../ai/bot.js";
import enhancedBot from "../ai/enhancedBot.js";
import { botResponseMiddleware } from "../middleware/botMiddleware.js";
import BlockingMiddleware from "../middleware/blockingMiddleware.js";

const router = express.Router();

// Helper to get or create conversation
const getConversation = async (userId1, userId2) => {
  // Try to find direct chat
  let chat = await prisma.chat.findFirst({
      where: {
          isGroup: false,
          AND: [
              { members: { some: { userId: userId1 } } },
              { members: { some: { userId: userId2 } } }
          ]
      }
  });
  
  if (!chat) {
      chat = await prisma.chat.create({
          data: {
              id: uuidv4(),
              updatedAt: new Date(),
              isGroup: false,
              members: {
                  create: [
                      { userId: userId1 },
                      { userId: userId2 }
                  ]
              }
          }
      });
  }
  return chat;
};

// Send message
router.post("/send-message", authMiddleware, BlockingMiddleware.checkMessagingAccess(), async (req, res) => {
  const { recipientId, message } = req.body;

  // Additional privacy check for messaging
  try {
    const privacyModule = await import('../services/privacyManager.js');
    const PrivacyManager = privacyModule.default;
    
    // Check if canSendMessage exists
    if (PrivacyManager.canSendMessage) {
         const canSendMessage = await PrivacyManager.canSendMessage(req.userId, recipientId);
         if (!canSendMessage) {
           return res.status(403).json({
             success: false,
             error: 'Cannot send message due to privacy settings'
           });
         }
    } else if (new PrivacyManager().canSendMessage) {
         const pm = new PrivacyManager();
         const canSendMessage = await pm.canSendMessage(req.userId, recipientId);
         if (!canSendMessage) {
           return res.status(403).json({
             success: false,
             error: 'Cannot send message due to privacy settings'
           });
         }
    }
  } catch (error) {
    console.error('Privacy check error:', error);
  }

  try {
      const chat = await getConversation(req.userId, recipientId);

      // Save message in DB (using EnhancedMessage for Prisma compatibility)
      const chatMessage = await prisma.enhancedMessage.create({
        data: {
            chatId: chat.id,
            senderId: req.userId,
            receiverId: recipientId,
            content: message,
            messageType: 'text',
            isBot: false,
            status: 'sent'
        }
      });
      
      // Update chat last message
      await prisma.chat.update({
          where: { id: chat.id },
          data: { lastMessageId: chatMessage.id }
      });

      // Create notification for new message
      try {
          const { createNotification } = await import('../services/notificationService.js');
          const sender = await prisma.user.findUnique({ where: { id: req.userId }, select: { username: true, name: true } });
          
          await createNotification({
              recipientId: recipientId,
              senderId: req.userId,
              type: 'MESSAGE',
              title: 'New Message',
              message: `${sender?.username || sender?.name || 'Someone'} sent you a message`,
              entityId: chat.id,
              entityType: 'CHAT',
              metadata: {
                  messageId: chatMessage.id,
                  preview: message.substring(0, 50)
              }
          });
      } catch (notifError) {
          console.error('Failed to create notification for message:', notifError);
          // Continue execution, don't fail message sending
      }

      // If recipient has Smart Bot enabled, auto-reply using enhanced bot
      try {
        const botResponse = await enhancedBot.generateResponse(recipientId, message);
        if (botResponse && !botResponse.error && botResponse.response) {
          const botMessage = await prisma.enhancedMessage.create({
            data: {
                chatId: chat.id,
                senderId: recipientId,
                receiverId: req.userId,
                content: botResponse.response,
                messageType: 'text',
                isBot: true,
                status: 'sent'
            }
          });
          
          await prisma.chat.update({
              where: { id: chat.id },
              data: { lastMessageId: botMessage.id }
          });
        }
      } catch (error) {
        console.error('Enhanced bot auto-reply error:', error);
        // Fallback to original bot (migrated to Prisma)
        const botReply = await getBotResponse(recipientId, message);
        if (botReply) {
          const botMessage = await prisma.enhancedMessage.create({
            data: {
                chatId: chat.id,
                senderId: recipientId,
                receiverId: req.userId,
                content: botReply,
                messageType: 'text',
                isBot: true,
                status: 'sent'
            }
          });
          
          await prisma.chat.update({
              where: { id: chat.id },
              data: { lastMessageId: botMessage.id }
          });
        }
      }

      res.json({ success: true });
  } catch (error) {
      console.error("Send message error:", error);
      res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/chat", botResponseMiddleware, (req, res) => {
    const { message } = req.body;
    let response;
  
    switch (req.botPersonality) {
      case "friendly":
        response = `😊 Hey there! I'm here to help. You said: "${message}"`;
        break;
      case "professional":
        response = `Hello. I acknowledge your message: "${message}". How can I assist you today?`;
        break;
      case "sarcastic":
        response = `Oh wow, another message... "${message}". Fascinating. 🤦`;
        break;
      default:
        response = `Hello! You said: "${message}"`;
    }
  
    res.status(200).json({ botReply: response });
  });

export default router;

/**
 * @swagger
 * /api/chat/send-message:
 *   post:
 *     summary: Send a message
 *     tags:
 *       - Chat
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - recipientId
 *               - message
 *             properties:
 *               recipientId:
 *                 type: string
 *               message:
 *                 type: string
 *     responses:
 *       200:
 *         description: Message sent successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 * 
 * /api/chat/bot-settings:
 *   put:
 *     summary: Update Smart Bot settings
 *     tags:
 *       - Bot
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - botEnabled
 *               - botPersonality
 *             properties:
 *               botEnabled:
 *                 type: boolean
 *               botPersonality:
 *                 type: string
 *                 enum: [friendly, professional, sarcastic]
 *     responses:
 *       200:
 *         description: Smart Bot settings updated successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 * 
 * /api/chat:
 *   post:
 *     summary: Interact with the Smart Bot
 *     tags:
 *       - Bot
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *     responses:
 *       200:
 *         description: Bot reply returned successfully
 *       400:
 *         description: Bad request
 *       403:
 *         description: Bot is disabled
 */
