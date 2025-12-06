import express from "express";
import Post from "../models/Post.js";
import User from "../models/User.js";
import Community from "../models/Community.js";
import LiveStream from "../models/LiveStream.js";
import { protect } from "../middleware/authMiddleware.js";
import privacyMiddleware from "../middleware/privacyMiddleware.js";

const router = express.Router();

/**
 * @swagger
 * /api/explore:
 *   get:
 *     summary: Get explore feed with trending content, suggested users, and communities
 *     tags: [Explore]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of posts per page
 *     responses:
 *       200:
 *         description: Explore feed retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get("/", protect, async (req, res) => {
  try {
    const userId = req.userId || req.user?.id || req.user?._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Get current user to exclude their own content and people they follow
    const currentUser = await User.findById(userId).select("following interests blockedUsers");
    
    if (!currentUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const blockedUserIds = currentUser.blockedUsers.map(b => b.user);
    const followingIds = currentUser.following || [];

    // 1. Trending Posts (high engagement, not from followed users)
    const trendingPosts = await Post.find({
      user: { $nin: [...followingIds, userId, ...blockedUserIds] },
      "privacy.level": "public",
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
    })
      .sort({ 
        views: -1, 
        "engagement.totalLikes": -1,
        "engagement.totalComments": -1 
      })
      .limit(limit)
      .skip(skip)
      .populate("user", "username name profilePicture blueTick goldenTick")
      .lean();

    // 2. Suggested Users (not following, similar interests, verified users)
    const suggestedUsers = await User.find({
      _id: { $nin: [...followingIds, userId, ...blockedUserIds] },
      $or: [
        { interests: { $in: currentUser.interests } },
        { blueTick: true },
        { goldenTick: true }
      ]
    })
      .sort({ "followers.length": -1 })
      .limit(10)
      .select("username name profilePicture bio blueTick goldenTick followers")
      .lean();

    // 3. Active Communities (public, high member count)
    const activeCommunities = await Community.find({
      "settings.isPrivate": false,
      isActive: true,
      _id: { $nin: currentUser.communities.map(c => c.community) }
    })
      .sort({ memberCount: -1, createdAt: -1 })
      .limit(8)
      .populate("owner", "username name profilePicture")
      .lean();

    // 4. Live Streams (currently active)
    const liveStreams = await LiveStream.find({
      status: "live",
      user: { $nin: [...blockedUserIds, userId] }
    })
      .sort({ viewerCount: -1, startedAt: -1 })
      .limit(5)
      .populate("user", "username name profilePicture blueTick goldenTick")
      .lean();

    // 5. Viral Posts (NFT eligible or high views)
    const viralPosts = await Post.find({
      user: { $nin: [...followingIds, userId, ...blockedUserIds] },
      "privacy.level": "public",
      $or: [
        { isEligibleForNFT: true },
        { views: { $gte: 50000 } }
      ]
    })
      .sort({ views: -1 })
      .limit(5)
      .populate("user", "username name profilePicture blueTick goldenTick")
      .lean();

    // 6. Interest-based Posts (based on user interests)
    let interestBasedPosts = [];
    if (currentUser.interests && currentUser.interests.length > 0) {
      // Find users with similar interests
      const usersWithSimilarInterests = await User.find({
        interests: { $in: currentUser.interests },
        _id: { $nin: [...followingIds, userId, ...blockedUserIds] }
      })
        .limit(50)
        .select("_id");

      const similarUserIds = usersWithSimilarInterests.map(u => u._id);

      interestBasedPosts = await Post.find({
        user: { $in: similarUserIds },
        "privacy.level": "public",
        createdAt: { $gte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) }
      })
        .sort({ createdAt: -1, "engagement.totalLikes": -1 })
        .limit(10)
        .populate("user", "username name profilePicture blueTick goldenTick")
        .lean();
    }

    // Calculate total for pagination
    const totalPosts = await Post.countDocuments({
      user: { $nin: [...followingIds, userId, ...blockedUserIds] },
      "privacy.level": "public"
    });

    res.json({
      success: true,
      data: {
        trending: trendingPosts,
        suggestedUsers: suggestedUsers.map(user => ({
          ...user,
          followersCount: user.followers?.length || 0,
          isFollowing: false
        })),
        communities: activeCommunities,
        liveStreams: liveStreams,
        viral: viralPosts,
        forYou: interestBasedPosts
      },
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalPosts / limit),
        totalPosts,
        hasMore: skip + trendingPosts.length < totalPosts
      }
    });
  } catch (error) {
    console.error("Explore feed error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error fetching explore feed",
      error: error.message 
    });
  }
});

export default router;
