import express from "express";
import { prisma } from "../config/db.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// Create a challenge
router.post("/create", authMiddleware, async (req, res) => {
  try {
    const { videoUrl } = req.body;
    const userId = req.user.id || req.user._id;

    const challenge = await prisma.challenge.create({
      data: {
        creatorId: userId,
        videoUrl,
        participants: [], // Initialize empty array
        votes: [], // Initialize empty array
        status: "active"
      }
    });

    res.json({ success: true, challenge });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Duet a challenge
router.put("/:challengeId/duet", authMiddleware, async (req, res) => {
  try {
    const { videoUrl } = req.body;
    const { challengeId } = req.params;
    const userId = req.user.id || req.user._id;

    const challenge = await prisma.challenge.findUnique({ where: { id: challengeId } });
    if (!challenge) return res.status(404).json({ message: "Challenge not found" });

    const participants = Array.isArray(challenge.participants) ? challenge.participants : [];
    participants.push({ user: userId, videoUrl });

    await prisma.challenge.update({
      where: { id: challengeId },
      data: { participants }
    });

    res.json({ success: true, message: "Duet added" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Vote for a challenge
router.put("/:challengeId/vote", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.body; // Or use req.user.id if voting as authenticated user? 
    // The original code used req.body.userId, but usually voting should be the authenticated user.
    // I will stick to req.body.userId to match original logic, but falling back to req.user.id if not provided would be safer.
    // However, the original code used `req.body.userId`.
    const voterId = userId || req.user.id || req.user._id;
    const { challengeId } = req.params;

    const challenge = await prisma.challenge.findUnique({ where: { id: challengeId } });
    if (!challenge) return res.status(404).json({ message: "Challenge not found" });

    const votes = Array.isArray(challenge.votes) ? challenge.votes : [];
    
    // Simulate $addToSet
    if (!votes.includes(voterId)) {
      votes.push(voterId);
      await prisma.challenge.update({
        where: { id: challengeId },
        data: { votes }
      });
    }

    res.json({ success: true, message: "Vote added" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// End Challenge (Admin or Creator)
router.put("/:challengeId/end", authMiddleware, async (req, res) => {
  try {
    const { winner, reason } = req.body;
    const { challengeId } = req.params;
    const userId = req.user.id || req.user._id;

    const challenge = await prisma.challenge.findUnique({ where: { id: challengeId } });
    
    if (!challenge) {
      return res.status(404).json({ success: false, message: "Challenge not found" });
    }

    // Check if user is creator or admin
    if (challenge.creatorId !== userId && !req.user.isAdmin) {
      return res.status(403).json({ success: false, message: "Not authorized to end this challenge" });
    }

    const updatedChallenge = await prisma.challenge.update({
      where: { id: challengeId },
      data: { 
        status: 'ended',
        endedAt: new Date(),
        winner: winner,
        endReason: reason || 'Ended by creator'
      }
    });

    res.json({ success: true, message: "Challenge ended successfully", challenge: updatedChallenge });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get All Challenges
router.get("/", async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    
    const where = status ? { status } : {};
    
    const [challenges, total] = await Promise.all([
      prisma.challenge.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limitNum,
        skip: (pageNum - 1) * limitNum,
        include: {
          creator: {
            select: { username: true, profilePicture: true }
          }
        }
      }),
      prisma.challenge.count({ where })
    ]);

    // Manually populate participants.user
    // participants is array of { user: userId, videoUrl: ... }
    const populatedChallenges = await Promise.all(challenges.map(async (challenge) => {
      let participants = challenge.participants;
      if (Array.isArray(challenge.participants) && challenge.participants.length > 0) {
        // Extract all user IDs from participants
        const userIds = challenge.participants.map(p => p.user).filter(id => id);
        
        if (userIds.length > 0) {
          const users = await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, username: true, profilePicture: true }
          });
          
          // Map users back to participants array
          participants = challenge.participants.map(p => {
            const userDetails = users.find(u => u.id === p.user);
            return {
              ...p,
              user: userDetails || p.user // fallback to ID if not found
            };
          });
        }
      }
      return { ...challenge, participants };
    }));

    res.json({ 
      success: true, 
      challenges: populatedChallenges,
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
