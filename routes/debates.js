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

// End Debate (Admin or Creator)
router.put("/:debateId/end", authMiddleware, async (req, res) => {
  try {
    const { winner, reason } = req.body;
    const debate = await Debate.findById(req.params.debateId);
    
    if (!debate) {
      return res.status(404).json({ success: false, message: "Debate not found" });
    }

    // Check if user is creator or admin
    if (debate.creator.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({ success: false, message: "Not authorized to end this debate" });
    }

    const updatedDebate = await Debate.findByIdAndUpdate(
      req.params.debateId,
      { 
        status: 'ended',
        endedAt: new Date(),
        winner: winner,
        endReason: reason || 'Ended by creator'
      },
      { new: true }
    );

    res.json({ success: true, message: "Debate ended successfully", debate: updatedDebate });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get All Debates
router.get("/", async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const filter = status ? { status } : {};
    
    const debates = await Debate.find(filter)
      .populate('participants', 'username profilePicture')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Debate.countDocuments(filter);

    res.json({ 
      success: true, 
      debates,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get Single Debate
router.get("/:debateId", async (req, res) => {
  try {
    const debate = await Debate.findById(req.params.debateId)
      .populate('participants', 'username profilePicture blueTick goldenTick')
      .populate('winner', 'username profilePicture');

    if (!debate) {
      return res.status(404).json({ success: false, message: "Debate not found" });
    }

    res.json({ success: true, debate });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
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
 * 
 * 
 * /api/debates/{debateId}/end:
 *   put:
 *     summary: End a debate
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
 *               - winner
 *             properties:
 *               winner:
 *                 type: string
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Debate ended successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Debate not found
 * 
 */
