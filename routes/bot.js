import express from "express";
import { prisma } from "../config/db.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * @swagger
 * /api/bot-settings:
 *    put:
 *      summary: Enable/Disable Smart Bot
 *      tags:
 *        - Bot
 *      security:
 *        - bearerAuth: []
 *      requestBody:
 *        required: true
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              required:
 *                - botEnabled
 *                - botPersonality
 *              properties:
 *                botEnabled:
 *                  type: boolean
 *                botPersonality:
 *                  type: string
 *                  enum: [friendly, professional, sarcastic]
 *      responses:
 *         200:
 *          description: Smart Bot settings updated successfully
 *         400:
 *          description: Bad request
 * 
 * /api/chat:
 *    post:
 *      summary: Interact with the Smart Bot
 *      tags:
 *        - Bot
 *      requestBody:
 *        required: true
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                message:
 *                  type: string
 *      responses:
 *         200:
 *          description: Bot reply returned successfully
 *         403:
 *          description: Bot is disabled
 */

// Update Smart Bot settings
router.put("/bot-settings", authMiddleware, async (req, res) => {
    const { botEnabled, botPersonality } = req.body;
  
    try {
      // Upsert: Create if not exists, Update if exists
      // Using userId as the unique key
      const botSettings = await prisma.botSettings.upsert({
        where: {
            userId: req.userId
        },
        update: {
            botEnabled,
            botPersonality
        },
        create: {
            userId: req.userId,
            botEnabled,
            botPersonality
        }
      });
  
      res.status(200).json({ message: "Smart Bot settings updated successfully", botSettings });
    } catch (error) {
      console.error("Update bot settings error:", error);
      res.status(400).json({ message: "Bad request", error: error.message });
    }
  });

export default router;
