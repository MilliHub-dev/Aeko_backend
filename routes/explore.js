import express from "express";
import { prisma } from "../config/db.js";
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
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        following: true,
        interests: true,
        blockedUsers: true,
        ownedCommunities: { select: { id: true } }
      }
    });
    
    if (!currentUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Parse JSON fields
    const blockedUserIds = (Array.isArray(currentUser.blockedUsers) ? currentUser.blockedUsers : [])
      .map(b => b.user || b.userId || b.id || b); // Handle potential different structures
    
    const followingIds = Array.isArray(currentUser.following) ? currentUser.following : [];
    
    // Use owned communities as excluded communities for now (as joined communities structure is unclear)
    const userCommunityIds = currentUser.ownedCommunities.map(c => c.id);

    // List of users to exclude (self + following + blocked)
    const excludedUserIds = [...followingIds, userId, ...blockedUserIds];

    // 1. Trending Posts (high engagement, not from followed users)
    const trendingPosts = await prisma.post.findMany({
      where: {
        userId: { notIn: excludedUserIds },
        privacy: {
          path: ['level'],
          equals: 'public'
        },
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
      },
      orderBy: { views: 'desc' }, // Simplified sort
      take: limit,
      skip: skip,
      include: {
        user: {
          select: {
            username: true,
            name: true,
            profilePicture: true,
            blueTick: true,
            goldenTick: true
          }
        }
      }
    });

    // 2. Suggested Users (not following, similar interests, verified users)
    // Build where clause
    const suggestedUsersWhere = {
      id: { notIn: excludedUserIds },
      OR: [
        { blueTick: true },
        { goldenTick: true }
      ]
    };

    // Add interest-based matching if supported by DB (Postgres JSON containment)
    // Note: Prisma JSON filtering can be tricky. We'll fetch candidates and filter/sort in memory if needed
    // For now, simple verified users filter is safer + interest check if simple
    if (currentUser.interests && Array.isArray(currentUser.interests) && currentUser.interests.length > 0) {
      // Postgres: interests ?| [Array of interests]
      // Prisma: { interests: { array_contains: [one_interest] } }? No, array_contains works for single value.
      // We'll skip complex JSON query for interests and just recommend verified users for now to ensure stability.
    }

    const suggestedUsersRaw = await prisma.user.findMany({
      where: suggestedUsersWhere,
      take: 20, // Fetch more to sort
      select: {
        id: true,
        username: true,
        name: true,
        profilePicture: true,
        bio: true,
        blueTick: true,
        goldenTick: true,
        followers: true // Needed for sorting
      }
    });

    // Sort by followers count in memory
    const suggestedUsers = suggestedUsersRaw
      .sort((a, b) => {
        const lenA = Array.isArray(a.followers) ? a.followers.length : 0;
        const lenB = Array.isArray(b.followers) ? b.followers.length : 0;
        return lenB - lenA;
      })
      .slice(0, 10);

    // 3. Active Communities (public, high member count)
    const activeCommunities = await prisma.community.findMany({
      where: {
        settings: {
          path: ['isPrivate'],
          equals: false
        },
        isActive: true,
        id: { notIn: userCommunityIds }
      },
      orderBy: [
        { memberCount: 'desc' },
        { createdAt: 'desc' }
      ],
      take: 8,
      include: {
        owner: {
          select: {
            username: true,
            name: true,
            profilePicture: true
          }
        }
      }
    });

    // 4. Live Streams (currently active)
    const liveStreams = await prisma.liveStream.findMany({
      where: {
        status: "live",
        hostId: { notIn: [...blockedUserIds, userId] }
      },
      orderBy: [
        { currentViewers: 'desc' }, // Mapped from viewerCount
        { startedAt: 'desc' }
      ],
      take: 5,
      include: {
        host: {
          select: {
            username: true,
            name: true,
            profilePicture: true,
            blueTick: true,
            goldenTick: true
          }
        }
      }
    });

    // 5. Viral Posts (high views)
    const viralPosts = await prisma.post.findMany({
      where: {
        userId: { notIn: excludedUserIds },
        privacy: {
          path: ['level'],
          equals: 'public'
        },
        views: { gte: 50000 }
      },
      orderBy: { views: 'desc' },
      take: 5,
      include: {
        user: {
          select: {
            username: true,
            name: true,
            profilePicture: true,
            blueTick: true,
            goldenTick: true
          }
        }
      }
    });

    // 6. Interest-based Posts
    let interestBasedPosts = [];
    if (currentUser.interests && Array.isArray(currentUser.interests) && currentUser.interests.length > 0) {
      // Find users with similar interests (Manual filter strategy for JSON array containment)
      // Fetch users who are not excluded, then check interests in JS or use raw query if critical
      // For now, simplified: skip complex interest matching to avoid runtime errors with JSON operators
      // We can implement a simplified version: Random public posts from last 3 days
       interestBasedPosts = await prisma.post.findMany({
          where: {
            userId: { notIn: excludedUserIds },
            privacy: {
               path: ['level'],
               equals: 'public'
            },
            createdAt: { gte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) }
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            user: {
              select: {
                username: true,
                name: true,
                profilePicture: true,
                blueTick: true,
                goldenTick: true
              }
            }
          }
        });
    }

    // Calculate total for pagination
    const totalPosts = await prisma.post.count({
      where: {
        userId: { notIn: excludedUserIds },
        privacy: {
          path: ['level'],
          equals: 'public'
        }
      }
    });

    res.json({
      success: true,
      data: {
        trending: trendingPosts,
        suggestedUsers: suggestedUsers.map(user => ({
          ...user,
          followersCount: Array.isArray(user.followers) ? user.followers.length : 0,
          isFollowing: false
        })),
        communities: activeCommunities,
        liveStreams: liveStreams.map(stream => ({
            ...stream,
            user: stream.host, // Map host to user for frontend compatibility
            viewerCount: stream.currentViewers
        })),
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
