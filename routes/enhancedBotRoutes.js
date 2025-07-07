import express from "express";
import User from "../models/User.js";
import BotSettings from "../models/BotSettings.js";
import BotConversation from "../models/BotConversation.js";
import authMiddleware from "../middleware/authMiddleware.js";
import enhancedBot from "../ai/enhancedBot.js";

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     BotSettings:
 *       type: object
 *       properties:
 *         botEnabled:
 *           type: boolean
 *         botPersonality:
 *           type: string
 *           enum: [friendly, professional, sarcastic, creative, analytical, mentor, companion]
 *         aiProvider:
 *           type: string
 *           enum: [openai, claude, cohere, local]
 *         model:
 *           type: string
 *         maxTokens:
 *           type: number
 *         contextLength:
 *           type: number
 *         temperature:
 *           type: number
 */

/**
 * @swagger
 * /api/enhanced-bot/chat:
 *   post:
 *     summary: Chat with Enhanced AI Bot
 *     tags: [Enhanced Bot]
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
 *               instruction:
 *                 type: string
 *               personalityOverride:
 *                 type: string
 *     responses:
 *       200:
 *         description: Bot response generated successfully
 *       403:
 *         description: Bot is disabled
 */
router.post("/chat", authMiddleware, async (req, res) => {
  try {
    const { message, instruction, personalityOverride } = req.body;
    
    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: "Message is required" });
    }

    const startTime = Date.now();
    
    const options = {};
    if (instruction) options.instruction = instruction;
    if (personalityOverride) options.personalityOverride = personalityOverride;

    const response = await enhancedBot.generateResponse(req.userId, message, options);
    
    const responseTime = Date.now() - startTime;

    if (response.error) {
      return res.status(403).json({ error: response.error });
    }

    // Update user analytics
    await User.findByIdAndUpdate(req.userId, {
      $inc: { 'botAnalytics.totalInteractions': 1 },
      $set: { 
        'botAnalytics.lastInteraction': new Date(),
        'botAnalytics.averageResponseTime': responseTime
      }
    });

    res.json({
      ...response,
      responseTime,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Enhanced bot chat error:', error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @swagger
 * /api/enhanced-bot/settings:
 *   get:
 *     summary: Get user's bot settings
 *     tags: [Enhanced Bot]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Bot settings retrieved successfully
 */
router.get("/settings", authMiddleware, async (req, res) => {
  try {
    let settings = await BotSettings.findOne({ userId: req.userId });
    
    if (!settings) {
      settings = await BotSettings.create({
        userId: req.userId,
        botEnabled: false,
        botPersonality: 'friendly'
      });
    }

    res.json(settings);
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: "Failed to retrieve settings" });
  }
});

/**
 * @swagger
 * /api/enhanced-bot/settings:
 *   put:
 *     summary: Update bot settings
 *     tags: [Enhanced Bot]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BotSettings'
 *     responses:
 *       200:
 *         description: Settings updated successfully
 */
router.put("/settings", authMiddleware, async (req, res) => {
  try {
    const allowedUpdates = [
      'botEnabled', 'botPersonality', 'aiProvider', 'model', 
      'maxTokens', 'contextLength', 'temperature', 'features',
      'customInstructions', 'responseStyle', 'restrictions'
    ];

    const updates = {};
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const settings = await BotSettings.findOneAndUpdate(
      { userId: req.userId },
      updates,
      { new: true, upsert: true }
    );

    // Also update user's bot settings
    const userUpdates = {};
    if (updates.botEnabled !== undefined) userUpdates.botEnabled = updates.botEnabled;
    if (updates.botPersonality !== undefined) userUpdates.botPersonality = updates.botPersonality;
    
    if (Object.keys(userUpdates).length > 0) {
      await User.findByIdAndUpdate(req.userId, userUpdates);
    }

    res.json({ message: "Settings updated successfully", settings });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: "Failed to update settings" });
  }
});

/**
 * @swagger
 * /api/enhanced-bot/personalities:
 *   get:
 *     summary: Get available bot personalities
 *     tags: [Enhanced Bot]
 *     responses:
 *       200:
 *         description: Available personalities retrieved successfully
 */
router.get("/personalities", (req, res) => {
  const personalities = {
    friendly: {
      name: "Friendly",
      description: "Warm, empathetic, and enthusiastic. Perfect for casual conversations.",
      traits: ["encouraging", "empathetic", "enthusiastic", "supportive"],
      emoji: "😊"
    },
    professional: {
      name: "Professional", 
      description: "Formal, precise, and knowledgeable. Great for business contexts.",
      traits: ["formal", "precise", "knowledgeable", "efficient"],
      emoji: "💼"
    },
    sarcastic: {
      name: "Sarcastic",
      description: "Witty and clever with a dry sense of humor.",
      traits: ["witty", "sarcastic", "clever", "humorous"],
      emoji: "😏"
    },
    creative: {
      name: "Creative",
      description: "Imaginative and artistic. Perfect for brainstorming and creative projects.",
      traits: ["creative", "imaginative", "artistic", "innovative"],
      emoji: "🎨"
    },
    analytical: {
      name: "Analytical",
      description: "Logical and data-driven. Great for problem-solving and analysis.",
      traits: ["logical", "analytical", "structured", "detail-oriented"],
      emoji: "📊"
    },
    mentor: {
      name: "Mentor",
      description: "Wise and patient guide for learning and personal growth.",
      traits: ["wise", "patient", "guiding", "supportive"],
      emoji: "🧙"
    },
    companion: {
      name: "Companion",
      description: "Loyal friend who remembers personal details and maintains deep conversations.",
      traits: ["loyal", "remembering", "personal", "deep"],
      emoji: "🤝"
    }
  };

  res.json({ personalities });
});

/**
 * @swagger
 * /api/enhanced-bot/conversation-history:
 *   get:
 *     summary: Get conversation history
 *     tags: [Enhanced Bot]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *         description: Number of conversations to retrieve
 *       - in: query
 *         name: page
 *         schema:
 *           type: number
 *         description: Page number
 *     responses:
 *       200:
 *         description: Conversation history retrieved successfully
 */
router.get("/conversation-history", authMiddleware, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    const conversations = await BotConversation.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .select('userMessage botResponse personality sentiment createdAt confidence');

    const total = await BotConversation.countDocuments({ userId: req.userId });

    res.json({
      conversations,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalConversations: total,
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get conversation history error:', error);
    res.status(500).json({ error: "Failed to retrieve conversation history" });
  }
});

/**
 * @swagger
 * /api/enhanced-bot/analytics:
 *   get:
 *     summary: Get bot usage analytics
 *     tags: [Enhanced Bot]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Analytics retrieved successfully
 */
router.get("/analytics", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('botAnalytics');
    
    // Get recent conversation statistics
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      recentConversations,
      sentimentStats,
      personalityStats,
      providerStats
    ] = await Promise.all([
      BotConversation.countDocuments({
        userId: req.userId,
        createdAt: { $gte: thirtyDaysAgo }
      }),
      BotConversation.aggregate([
        { $match: { userId: req.userId } },
        { $group: { _id: '$sentiment', count: { $sum: 1 } } }
      ]),
      BotConversation.aggregate([
        { $match: { userId: req.userId } },
        { $group: { _id: '$personality', count: { $sum: 1 } } }
      ]),
      BotConversation.aggregate([
        { $match: { userId: req.userId } },
        { $group: { _id: '$aiProvider', count: { $sum: 1 } } }
      ])
    ]);

    res.json({
      userAnalytics: user?.botAnalytics || {},
      recentActivity: {
        conversationsLast30Days: recentConversations,
        sentimentDistribution: sentimentStats,
        personalityUsage: personalityStats,
        providerUsage: providerStats
      }
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ error: "Failed to retrieve analytics" });
  }
});

/**
 * @swagger
 * /api/enhanced-bot/generate-image:
 *   post:
 *     summary: Generate image using AI
 *     tags: [Enhanced Bot]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - prompt
 *             properties:
 *               prompt:
 *                 type: string
 *     responses:
 *       200:
 *         description: Image generated successfully
 *       403:
 *         description: Image generation not available
 */
router.post("/generate-image", authMiddleware, async (req, res) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt || prompt.trim().length === 0) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const result = await enhancedBot.generateImage(prompt, req.userId);
    
    if (result.error) {
      return res.status(403).json({ error: result.error });
    }

    res.json(result);
  } catch (error) {
    console.error('Generate image error:', error);
    res.status(500).json({ error: "Failed to generate image" });
  }
});

/**
 * @swagger
 * /api/enhanced-bot/summarize-conversation:
 *   post:
 *     summary: Summarize conversation history
 *     tags: [Enhanced Bot]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               days:
 *                 type: number
 *                 default: 7
 *     responses:
 *       200:
 *         description: Conversation summarized successfully
 */
router.post("/summarize-conversation", authMiddleware, async (req, res) => {
  try {
    const { days = 7 } = req.body;
    
    const summary = await enhancedBot.summarizeConversation(req.userId, days);
    
    res.json({ summary, days });
  } catch (error) {
    console.error('Summarize conversation error:', error);
    res.status(500).json({ error: "Failed to summarize conversation" });
  }
});

/**
 * @swagger
 * /api/enhanced-bot/rate-response:
 *   post:
 *     summary: Rate bot response
 *     tags: [Enhanced Bot]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - conversationId
 *               - rating
 *             properties:
 *               conversationId:
 *                 type: string
 *               rating:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 5
 *               feedback:
 *                 type: string
 *     responses:
 *       200:
 *         description: Response rated successfully
 */
router.post("/rate-response", authMiddleware, async (req, res) => {
  try {
    const { conversationId, rating, feedback } = req.body;
    
    if (!conversationId || !rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Valid conversation ID and rating (1-5) are required" });
    }

    const conversation = await BotConversation.findOneAndUpdate(
      { _id: conversationId, userId: req.userId },
      { 
        rating,
        feedback,
        ratedAt: new Date()
      },
      { new: true }
    );

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    // Update user's average satisfaction rating
    const avgRating = await BotConversation.aggregate([
      { $match: { userId: req.userId, rating: { $exists: true } } },
      { $group: { _id: null, averageRating: { $avg: '$rating' } } }
    ]);

    if (avgRating.length > 0) {
      await User.findByIdAndUpdate(req.userId, {
        'botAnalytics.satisfactionRating': avgRating[0].averageRating
      });
    }

    res.json({ message: "Response rated successfully", conversation });
  } catch (error) {
    console.error('Rate response error:', error);
    res.status(500).json({ error: "Failed to rate response" });
  }
});

export default router;