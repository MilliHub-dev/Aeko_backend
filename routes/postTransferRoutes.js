import express from "express";
import { prisma } from "../config/db.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * @swagger
 * /api/posts/transfer:
 *   post:
 *     summary: Transfer a post to another user
 *     tags: [Post Transfer]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - postId
 *               - toUserId
 *             properties:
 *               postId:
 *                 type: string
 *                 description: ID of the post to transfer
 *               toUserId:
 *                 type: string
 *                 description: ID of the user to transfer to
 *               reason:
 *                 type: string
 *                 description: Optional reason for transfer
 *     responses:
 *       200:
 *         description: Post transferred successfully
 *       400:
 *         description: Invalid request
 *       403:
 *         description: Not authorized to transfer this post
 *       404:
 *         description: Post or user not found
 */
router.post("/transfer", authMiddleware, async (req, res) => {
  try {
    const { postId, toUserId, reason = "" } = req.body;
    const currentUserId = req.user.id || req.user._id;

    // Validate input
    if (!postId || !toUserId) {
      return res.status(400).json({ 
        success: false, 
        message: "Post ID and target user ID are required" 
      });
    }

    // Get the post
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) {
      return res.status(404).json({ 
        success: false, 
        message: "Post not found" 
      });
    }

    // Check if current user owns the post
    if (post.userId !== currentUserId) {
      return res.status(403).json({ 
        success: false, 
        message: "You can only transfer your own posts" 
      });
    }

    // Check if target user exists
    const targetUser = await prisma.user.findUnique({ where: { id: toUserId } });
    if (!targetUser) {
      return res.status(404).json({ 
        success: false, 
        message: "Target user not found" 
      });
    }

    // Cannot transfer to yourself
    if (toUserId === currentUserId) {
      return res.status(400).json({ 
        success: false, 
        message: "Cannot transfer post to yourself" 
      });
    }



    // Perform the transfer
    const transferEntry = {
      fromUser: currentUserId,
      toUser: toUserId,
      reason,
      timestamp: new Date()
    };

    const transferHistory = Array.isArray(post.transferHistory) ? post.transferHistory : [];
    transferHistory.push(transferEntry);

    const ownershipChain = Array.isArray(post.ownershipChain) ? post.ownershipChain : [];
    if (!ownershipChain.includes(toUserId)) {
      ownershipChain.push(toUserId);
    }

    // In Prisma, updating the relation automatically updates the foreign key
    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: {
        userId: toUserId,
        transferHistory,
        ownershipChain
      },
      include: {
        user: { select: { username: true, profilePicture: true } },
        originalOwner: { select: { username: true, profilePicture: true } }
      }
    });

    res.json({
      success: true,
      message: "Post transferred successfully",
      data: {
        post: updatedPost,
        transferDetails: {
          fromUser: req.user.username,
          toUser: targetUser.username,
          reason,
          timestamp: new Date()
        }
      }
    });

  } catch (error) {
    console.error("Post transfer error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error during post transfer" 
    });
  }
});

/**
 * @swagger
 * /api/posts/transfer-history/{postId}:
 *   get:
 *     summary: Get transfer history of a post
 *     tags: [Post Transfer]
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *         description: Post ID
 *     responses:
 *       200:
 *         description: Transfer history retrieved successfully
 *       404:
 *         description: Post not found
 */
router.get("/transfer-history/:postId", async (req, res) => {
  try {
    const { postId } = req.params;

    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        originalOwner: { select: { username: true, profilePicture: true } },
        user: { select: { username: true, profilePicture: true } }
      }
    });

    if (!post) {
      return res.status(404).json({ 
        success: false, 
        message: "Post not found" 
      });
    }

    // Manually populate transfer history if needed
    // Assuming transferHistory is array of objects { fromUser: id, toUser: id, ... }
    let transferHistory = post.transferHistory;
    if (Array.isArray(transferHistory) && transferHistory.length > 0) {
      const userIds = new Set();
      transferHistory.forEach(t => {
        if (t.fromUser) userIds.add(t.fromUser);
        if (t.toUser) userIds.add(t.toUser);
      });
      
      const users = await prisma.user.findMany({
        where: { id: { in: Array.from(userIds) } },
        select: { id: true, username: true, profilePicture: true }
      });
      
      transferHistory = transferHistory.map(t => ({
        ...t,
        fromUser: users.find(u => u.id === t.fromUser) || { id: t.fromUser },
        toUser: users.find(u => u.id === t.toUser) || { id: t.toUser }
      }));
    }

    res.json({
      success: true,
      data: {
        postId,
        ownershipChain: post.ownershipChain,
        transferHistory: transferHistory,
        currentOwner: post.user,
        originalOwner: post.originalOwner
      }
    });

  } catch (error) {
    console.error("Get transfer history error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error getting transfer history" 
    });
  }
});

export default router;
