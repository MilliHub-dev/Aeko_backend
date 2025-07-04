import express from "express";
import Debate from "../models/Debate.js";
import authMiddleware from "../middleware/authMiddleware.js";
import getBotResponse from "../ai/bot.js";

const router = express.Router();

// Start Debate
router.post("/start", authMiddleware, async (req, res) => {
  try {
    const { topic, participants } = req.body;
    const debate = new Debate({ topic, participants, scores: {}, votes: {} });
    await debate.save();
    res.json({ success: true, debate });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// AI Scoring
router.put("/:debateId/score", authMiddleware, async (req, res) => {
  try {
    const { participantId, message } = req.body;
    const score = await getBotResponse(participantId, message); // AI Evaluates
    await Debate.findByIdAndUpdate(req.params.debateId, {
      $set: { [`scores.${participantId}`]: score },
    });

    res.json({ success: true, score });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Vote for a Winner
router.put("/:debateId/vote", authMiddleware, async (req, res) => {
  try {
    const { participantId } = req.body;
    await Debate.findByIdAndUpdate(req.params.debateId, {
      $inc: { [`votes.${participantId}`]: 1 },
    });

    res.json({ success: true, message: "Vote added" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
/**
 * @swagger
 * /api/debates/start:
 *   post:
 *     summary: Start a debate
 *     tags:
 *       - Debates
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - topic
 *               - participants
 *             properties:
 *               topic:
 *                 type: string
 *               participants:
 *                 type: array
 *                 items:
 *                   type: string
 *             example:
 *               topic: "Is AI beneficial to humanity?"
 *               participants: ["user1", "user2"]
 *     responses:
 *       200:
 *         description: Debate started successfully
 *       400:
 *         description: Bad request
 * 
 * /api/debates/{debateId}/score:
 *   put:
 *     summary: AI scores a participant in a debate
 *     tags:
 *       - Debates
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: debateId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - participantId
 *               - message
 *             properties:
 *               participantId:
 *                 type: string
 *               message:
 *                 type: string
 *     responses:
 *       200:
 *         description: Score updated successfully
 *       400:
 *         description: Bad request
 *       404:
 *         description: Debate not found
 * 
 * /api/debates/{debateId}/vote:
 *   put:
 *     summary: Vote for a participant in a debate
 *     tags:
 *       - Debates
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: debateId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - participantId
 *             properties:
 *               participantId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Vote added successfully
 *       400:
 *         description: Bad request
 *       404:
 *         description: Debate not found
 */
