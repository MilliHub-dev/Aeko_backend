import express from "express";
import Post from "../models/Post.js";
import User from "../models/User.js";
import auth from "../middleware/auth.js";

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
router.post("/transfer", auth, async (req, res) => {
  try {
    const { postId, toUserId, reason = "" } = req.body;
    const currentUserId = req.user.id;

    // Validate input
    if (!postId || !toUserId) {
      return res.status(400).json({ 
        success: false, 
        message: "Post ID and target user ID are required" 
      });
    }

    // Get the post
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ 
        success: false, 
        message: "Post not found" 
      });
    }

    // Check if current user owns the post
    if (post.user.toString() !== currentUserId) {
      return res.status(403).json({ 
        success: false, 
        message: "You can only transfer your own posts" 
      });
    }

    // Check if target user exists
    const targetUser = await User.findById(toUserId);
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

    // Check if post is an NFT (special handling required)
    if (post.nftMinted) {
      return res.status(400).json({ 
        success: false, 
        message: "Cannot transfer posts that have been minted as NFTs. Use NFT marketplace instead." 
      });
    }

    // Perform the transfer
    await post.transferTo(toUserId, currentUserId, reason);

    // Update user post counts
    await User.findByIdAndUpdate(currentUserId, {
      $pull: { posts: postId }
    });

    await User.findByIdAndUpdate(toUserId, {
      $push: { posts: postId }
    });

    // Populate the updated post for response
    const updatedPost = await Post.findById(postId)
      .populate('user', 'username profilePicture')
      .populate('originalOwner', 'username profilePicture')
      .populate('transferHistory.fromUser', 'username')
      .populate('transferHistory.toUser', 'username');

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

    const post = await Post.findById(postId)
      .populate('originalOwner', 'username profilePicture')
      .populate('user', 'username profilePicture')
      .populate('transferHistory.fromUser', 'username profilePicture')
      .populate('transferHistory.toUser', 'username profilePicture');

    if (!post) {
      return res.status(404).json({ 
        success: false, 
        message: "Post not found" 
      });
    }

    res.json({
      success: true,
      data: {
        postId,
        ownershipChain: post.ownershipChain,
        transferHistory: post.transferHistory,
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

/**
 * @swagger
 * /api/posts/my-received-posts:
 *   get:
 *     summary: Get posts received through transfers
 *     tags: [Post Transfer]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Received posts retrieved successfully
 */
router.get("/my-received-posts", auth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Find posts where user is current owner but not original owner
    const receivedPosts = await Post.find({
      user: userId,
      originalOwner: { $ne: userId, $exists: true }
    })
    .populate('originalOwner', 'username profilePicture')
    .populate('transferHistory.fromUser', 'username profilePicture')
    .sort({ updatedAt: -1 });

    res.json({
      success: true,
      data: {
        posts: receivedPosts,
        count: receivedPosts.length
      }
    });

  } catch (error) {
    console.error("Get received posts error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error getting received posts" 
    });
  }
});

/**
 * @swagger
 * /api/posts/my-transferred-posts:
 *   get:
 *     summary: Get posts that user has transferred to others
 *     tags: [Post Transfer]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Transferred posts retrieved successfully
 */
router.get("/my-transferred-posts", auth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Find posts where user is original owner but not current owner
    const transferredPosts = await Post.find({
      originalOwner: userId,
      user: { $ne: userId }
    })
    .populate('user', 'username profilePicture')
    .populate('transferHistory.toUser', 'username profilePicture')
    .sort({ updatedAt: -1 });

    res.json({
      success: true,
      data: {
        posts: transferredPosts,
        count: transferredPosts.length
      }
    });

  } catch (error) {
    console.error("Get transferred posts error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error getting transferred posts" 
    });
  }
});

/**
 * @swagger
 * /api/posts/increment-view/{postId}:
 *   post:
 *     summary: Increment view count for a post
 *     tags: [Post Transfer]
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *         description: Post ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *                 description: Optional user ID for unique view tracking
 *     responses:
 *       200:
 *         description: View incremented successfully
 *       404:
 *         description: Post not found
 */
router.post("/increment-view/:postId", async (req, res) => {
  try {
    const { postId } = req.params;
    const { userId } = req.body;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ 
        success: false, 
        message: "Post not found" 
      });
    }

    // Increment view
    await post.incrementView(userId);

    // Update engagement metrics
    await post.updateEngagement();

    res.json({
      success: true,
      data: {
        views: post.views,
        uniqueViewers: post.uniqueViewers.length,
        isEligibleForNFT: post.isEligibleForNFT,
        engagementRate: post.engagement.engagementRate
      }
    });

  } catch (error) {
    console.error("Increment view error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error incrementing view" 
    });
  }
});

/**
 * @swagger
 * /api/posts/nft-eligible:
 *   get:
 *     summary: Get posts eligible for NFT minting
 *     tags: [Post Transfer]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: NFT eligible posts retrieved successfully
 */
router.get("/nft-eligible", auth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user's Aeko balance to check eligibility
    const user = await User.findById(userId);
    const hasAekoCoins = user.aekoBalance > 0;

    const eligiblePosts = await Post.find({
      user: userId,
      isEligibleForNFT: true,
      nftMinted: false,
      views: { $gte: 200000 }
    }).sort({ views: -1 });

    res.json({
      success: true,
      data: {
        posts: eligiblePosts,
        userAekoBalance: user.aekoBalance,
        hasAekoCoins,
        eligibilityMet: hasAekoCoins && eligiblePosts.length > 0,
        requirements: {
          minViews: 200000,
          mustHoldAekoCoins: true,
          postNotAlreadyMinted: true
        }
      }
    });

  } catch (error) {
    console.error("Get NFT eligible posts error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error getting NFT eligible posts" 
    });
  }
});

export default router;