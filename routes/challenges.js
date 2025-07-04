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
 */

