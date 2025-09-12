import express from "express";
import Challenge from "../models/Challenge.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();



// Create a challenge
router.post("/create", authMiddleware, async (req, res) => {
  try {
    const { videoUrl } = req.body;
    const challenge = new Challenge({ creator: req.userId, videoUrl });
    await challenge.save();
    res.json({ success: true, challenge });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Duet a challenge
router.put("/:challengeId/duet", authMiddleware, async (req, res) => {
  try {
    const { videoUrl } = req.body;
    await Challenge.findByIdAndUpdate(req.params.challengeId, {
      $push: { participants: { user: req.userId, videoUrl } },
    });

    res.json({ success: true, message: "Duet added" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Vote for a challenge
router.put("/:challengeId/vote", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.body;
    await Challenge.findByIdAndUpdate(req.params.challengeId, {
      $addToSet: { votes: userId },
    });

    res.json({ success: true, message: "Vote added" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// End Challenge (Admin or Creator)
router.put("/:challengeId/end", authMiddleware, async (req, res) => {
  try {
    const { winner, reason } = req.body;
    const challenge = await Challenge.findById(req.params.challengeId);
    
    if (!challenge) {
      return res.status(404).json({ success: false, message: "Challenge not found" });
    }

    // Check if user is creator or admin
    if (challenge.creator.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({ success: false, message: "Not authorized to end this challenge" });
    }

    const updatedChallenge = await Challenge.findByIdAndUpdate(
      req.params.challengeId,
      { 
        status: 'ended',
        endedAt: new Date(),
        winner: winner,
        endReason: reason || 'Ended by creator'
      },
      { new: true }
    );

    res.json({ success: true, message: "Challenge ended successfully", challenge: updatedChallenge });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get All Challenges
router.get("/", async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const filter = status ? { status } : {};
    
    const challenges = await Challenge.find(filter)
      .populate('creator', 'username profilePicture')
      .populate('participants.user', 'username profilePicture')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Challenge.countDocuments(filter);

    res.json({ 
      success: true, 
      challenges,
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

// Get Single Challenge
router.get("/:challengeId", async (req, res) => {
  try {
    const challenge = await Challenge.findById(req.params.challengeId)
      .populate('creator', 'username profilePicture blueTick goldenTick')
      .populate('participants.user', 'username profilePicture blueTick goldenTick')
      .populate('winner', 'username profilePicture');

    if (!challenge) {
      return res.status(404).json({ success: false, message: "Challenge not found" });
    }

    res.json({ success: true, challenge });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
/**
 * @swagger
 * /api/challenges/create:
 *   post:
 *     summary: Create a challenge
 *     tags:
 *       - Challenges
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - videoUrl
 *             properties:
 *               videoUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: Challenge created successfully
 *       400:
 *         description: Bad request
 * 
 * /api/challenges/{challengeId}/duet:
 *   put:
 *     summary: Duet a challenge
 *     tags:
 *       - Challenges
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: challengeId
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
 *               - videoUrl
 *             properties:
 *               videoUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: Duet added successfully
 *       400:
 *         description: Bad request
 *       404:
 *         description: Challenge not found
 * 
 * /api/challenges/{challengeId}/vote:
 *   put:
 *     summary: Vote for a challenge
 *     tags:
 *       - Challenges
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: challengeId
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
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Vote added successfully
 *       400:
 *         description: Bad request
 *       404:
 *         description: Challenge not found
 * 
 * /api/challenges/{challengeId}/end:
 *   put:
 *     summary: End a challenge
 *     tags:
 *       - Challenges
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: challengeId
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
 *         description: Challenge ended successfully
 *       400:
 *         description: Bad request
 *       404:
 *         description: Challenge not found
 */

