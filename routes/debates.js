import express from "express";
import { prisma } from "../config/db.js";
import authMiddleware from "../middleware/authMiddleware.js";
import getBotResponse from "../ai/bot.js";

const router = express.Router();

// Start Debate
router.post("/start", authMiddleware, async (req, res) => {
  try {
    const { topic, participants } = req.body;
    const userId = req.user.id || req.user._id;

    const debate = await prisma.debate.create({
      data: {
        topic,
        participants, // Assuming array of user IDs
        creatorId: userId,
        scores: {},
        votes: {},
        status: "active"
      }
    });
    
    res.json({ success: true, debate });
  } catch (error) {
    console.error("Error starting debate:", error);
    res.status(500).json({ error: error.message });
  }
});

// AI Scoring
router.put("/:debateId/score", authMiddleware, async (req, res) => {
  try {
    const { participantId, message } = req.body;
    const { debateId } = req.params;

    const debate = await prisma.debate.findUnique({ where: { id: debateId } });
    if (!debate) return res.status(404).json({ success: false, message: "Debate not found" });

    const score = await getBotResponse(participantId, message); // AI Evaluates
    
    const scores = debate.scores || {};
    scores[participantId] = score;

    await prisma.debate.update({
      where: { id: debateId },
      data: { scores }
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
    const { debateId } = req.params;

    const debate = await prisma.debate.findUnique({ where: { id: debateId } });
    if (!debate) return res.status(404).json({ success: false, message: "Debate not found" });

    const votes = debate.votes || {};
    votes[participantId] = (votes[participantId] || 0) + 1;

    await prisma.debate.update({
      where: { id: debateId },
      data: { votes }
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
    const { debateId } = req.params;
    const userId = req.user.id || req.user._id;

    const debate = await prisma.debate.findUnique({ where: { id: debateId } });
    
    if (!debate) {
      return res.status(404).json({ success: false, message: "Debate not found" });
    }

    // Check if user is creator or admin
    // Note: isAdmin might be boolean in user object, but req.user structure depends on middleware
    if (debate.creatorId !== userId && !req.user.isAdmin) {
      return res.status(403).json({ success: false, message: "Not authorized to end this debate" });
    }

    const updatedDebate = await prisma.debate.update({
      where: { id: debateId },
      data: { 
        status: 'ended',
        endedAt: new Date(),
        winner: winner,
        endReason: reason || 'Ended by creator'
      }
    });

    res.json({ success: true, message: "Debate ended successfully", debate: updatedDebate });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get All Debates
router.get("/", async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    
    const where = status ? { status } : {};
    
    const [debates, total] = await Promise.all([
      prisma.debate.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limitNum,
        skip: (pageNum - 1) * limitNum,
        // We can't populate participants easily if it's a JSON array of IDs
        // But we can include creator if needed
      }),
      prisma.debate.count({ where })
    ]);

    // Manually populate participants if they are stored as array of IDs
    const populatedDebates = await Promise.all(debates.map(async (debate) => {
      let participants = debate.participants;
      if (Array.isArray(debate.participants) && debate.participants.length > 0) {
        // Assume participants is array of IDs
        const users = await prisma.user.findMany({
          where: { id: { in: debate.participants } },
          select: { id: true, username: true, profilePicture: true }
        });
        participants = users;
      }
      return { ...debate, participants };
    }));

    res.json({ 
      success: true, 
      debates: populatedDebates,
      pagination: {
        current: pageNum,
        pages: Math.ceil(total / limitNum),
        total,
        limit: limitNum
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
