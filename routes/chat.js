import express from "express";
import Chat from "../models/Chat.js";
import authMiddleware from "../middleware/authMiddleware.js";
import getBotResponse from "../ai/bot.js";
import enhancedBot from "../ai/enhancedBot.js";
import { botResponseMiddleware} from "../middleware/botMiddleware.js";


const router = express.Router();

// Send message
router.post("/send-message", authMiddleware, async (req, res) => {
  const { recipientId, message } = req.body;

  // Save message in DB
  const chatMessage = new Chat({
    sender: req.userId,
    recipient: recipientId,
    message,
  });
  await chatMessage.save();

  // If recipient has Smart Bot enabled, auto-reply using enhanced bot
  try {
    const botResponse = await enhancedBot.generateResponse(recipientId, message);
    if (botResponse && !botResponse.error && botResponse.response) {
      const botMessage = new Chat({
        sender: recipientId,
        recipient: req.userId,
        message: botResponse.response,
        isBot: true, // Mark as bot message
      });
      await botMessage.save();
    }
  } catch (error) {
    console.error('Enhanced bot auto-reply error:', error);
    // Fallback to original bot
    const botReply = await getBotResponse(recipientId, message);
    if (botReply) {
      const botMessage = new Chat({
        sender: recipientId,
        recipient: req.userId,
        message: botReply,
        isBot: true,
      });
      await botMessage.save();
    }
  }

  res.json({ success: true });
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
