import express from "express";
import User from "../models/User.js";
import authMiddleware from "../middleware/authMiddleware.js";
import BotSettings from "../models/BotSettings.js";

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
      let botSettings = await BotSettings.findOne();
      
      if (!botSettings) {
        botSettings = new BotSettings();
      }
  
      botSettings.botEnabled = botEnabled;
      botSettings.botPersonality = botPersonality;
  
      await botSettings.save();
  
      res.status(200).json({ message: "Smart Bot settings updated successfully", botSettings });
    } catch (error) {
      res.status(400).json({ message: "Bad request", error });
    }
  });



export default router;
