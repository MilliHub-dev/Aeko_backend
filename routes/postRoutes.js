import express from "express";
import { prisma } from "../config/db.js";
import { Prisma } from "@prisma/client";
import upload from "../middleware/upload.js";
import authMiddleware from "../middleware/authMiddleware.js";
import BlockingService from "../services/blockingService.js";
import { connection, explorer, sendChainError } from "../chain/client.js";
import { getCustodialAddress, isCustodyConfigured } from "../chain/custodialKeypair.js";
import { toBase58Hash } from "../chain/utils.js";
import { deriveWithSeed, getMinBalanceForRentExemption } from "../chain/utils.js";
import { buildPreparedAnchorPostTransaction } from "@aeko-chain/sdk";
import { PROGRAM_IDS, buildPreparedMintWithAccountSetupTransaction, estimateTokenAccountSpace } from "@aeko-chain/web3.js";
import { uploadJSON } from "../services/ipfsService.js";

const router = express.Router();

// Helper to validate IDs
const isValidId = (id) => {
  return id && typeof id === 'string' && id.trim().length > 0;
};

// Helper to inject Cloudinary transformation into URLs
const transformCloudinaryUrl = (url, transformation) => {
  if (!url || typeof url !== 'string') return url;
  const marker = '/upload/';
  const idx = url.indexOf(marker);
  if (idx === -1 || !transformation) return url;
  if (url.slice(idx + marker.length).startsWith('e_')) return url;
  return url.slice(0, idx + marker.length) + transformation + '/' + url.slice(idx + marker.length);
};

// Helper to build privacy and blocking where clause
const getPrivacyWhereClause = async (requestingUserId) => {
    if (!requestingUserId) {
        return {
            OR: [
                { privacy: { path: ['level'], equals: 'public' } },
                { privacy: { equals: Prisma.JsonNull } }
            ]
        };
    }

    const user = await prisma.user.findUnique({ 
        where: { id: requestingUserId },
        select: { following: true, blockedUsers: true } 
    });
    
    const followingIds = Array.isArray(user?.following) ? user.following : [];
    
    // Get users I have blocked
    const blockedUserIds = (Array.isArray(user?.blockedUsers) ? user.blockedUsers : [])
        .map(b => b.user || b.userId || b.id || b);

    // We should exclude posts from users I blocked
    const notInBlocked = { userId: { notIn: blockedUserIds } };

    return {
        AND: [
            notInBlocked,
            {
                OR: [
                    { privacy: { path: ['level'], equals: 'public' } },
                    { privacy: { equals: Prisma.JsonNull } },
                    { userId: requestingUserId },
                    {
                        AND: [
                            { privacy: { path: ['level'], equals: 'select_users' } },
                            { privacy: { path: ['selectedUsers'], array_contains: requestingUserId } }
                        ]
                    },
                    {
                        AND: [
                            { privacy: { path: ['level'], equals: 'followers' } },
                            { userId: { in: followingIds } }
                        ]
                    }
                ]
            }
        ]
    };
};

// Not Interested
router.post("/:postId/not-interested", authMiddleware, async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.user.id || req.user._id;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { notInterested: true }
        });

        let notInterested = user.notInterested || { posts: [], users: [], tags: [] };
        // Ensure structure if it was initialized differently or null
        if (typeof notInterested !== 'object') notInterested = { posts: [], users: [], tags: [] };
        if (!Array.isArray(notInterested.posts)) notInterested.posts = [];
        
        if (!notInterested.posts.includes(postId)) {
            notInterested.posts.push(postId);
            
            await prisma.user.update({
                where: { id: userId },
                data: { notInterested }
            });
        }

        res.json({ success: true, message: "Post marked as not interested" });
    } catch (error) {
        console.error("Not Interested Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Bookmark a post
router.post("/:postId/bookmark", authMiddleware, async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.user.id || req.user._id;

        const post = await prisma.post.findUnique({ where: { id: postId } });
        if (!post) {
            return res.status(404).json({ message: "Post not found" });
        }

        const existingBookmark = await prisma.bookmark.findUnique({
            where: {
                userId_postId: {
                    userId: userId,
                    postId: postId
                }
            }
        });

        if (existingBookmark) {
            // Unbookmark
            await prisma.bookmark.delete({
                where: { id: existingBookmark.id }
            });
            
            const totalBookmarks = await prisma.bookmark.count({ where: { postId } });
            
            // Update post engagement
            const currentEngagement = post.engagement || {};
            await prisma.post.update({
                where: { id: postId },
                data: {
                    engagement: {
                        ...currentEngagement,
                        totalBookmarks
                    }
                }
            });

            return res.status(200).json({ 
                message: "Bookmark removed successfully", 
                bookmarked: false,
                totalBookmarks 
            });
        } else {
            // Bookmark
            await prisma.bookmark.create({
                data: {
                    userId,
                    postId
                }
            });

            const totalBookmarks = await prisma.bookmark.count({ where: { postId } });
            const currentEngagement = post.engagement || {};
            
            await prisma.post.update({
                where: { id: postId },
                data: {
                    engagement: {
                        ...currentEngagement,
                        totalBookmarks
                    }
                }
            });

            return res.status(200).json({ 
                message: "Post bookmarked successfully", 
                bookmarked: true,
                totalBookmarks
            });
        }

    } catch (error) {
        console.error("Bookmark Error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Get user bookmarks
/**
 * Prisma exposes a post's author as `users_posts_userIdTouser`; every client
 * reads `user`. Five queries in this file included a `user` relation that does
 * not exist on Post, which makes Prisma reject the whole query — `/mixed` and
 * `/videos` (the reels feed) among them.
 */
const withAuthor = (post) =>
  post && {
    ...post,
    _id: post.id,
    user: post.users_posts_userIdTouser ?? post.user,
    users_posts_userIdTouser: undefined,
  };


// ---------------------------------------------------------------------------
// Post → NFT
//
// A post becomes mintable once it has earned enough engagement. The threshold
// is a product lever, so it lives in config rather than being hardcoded here.
// ---------------------------------------------------------------------------

const NFT_SETTINGS_DEFAULTS = {
  engagementThreshold: Number(process.env.AEKO_NFT_ENGAGEMENT_THRESHOLD) || 5,
  likeWeight: 1,
  commentWeight: 2,
  viewsPerPoint: 100,
  mintingEnabled: true,
  maxRoyaltyBps: 1000,
};

// Read per request would mean a query per post list; the rules change rarely,
// so a short cache keeps the admin edit responsive without the traffic.
const NFT_SETTINGS_TTL_MS = 30_000;
let nftSettingsCache = { value: null, expiresAt: 0 };

/**
 * The live post-to-NFT rules.
 *
 * These used to be a hardcoded env var, so tuning the threshold required a
 * redeploy. They now live in a single `nft_settings` row that the admin panel
 * edits. The defaults above apply until a row exists, and are also the fallback
 * if the table cannot be read — a settings lookup must never take down the feed.
 */
async function getNftSettings() {
  if (nftSettingsCache.value && Date.now() < nftSettingsCache.expiresAt) {
    return nftSettingsCache.value;
  }
  try {
    const row = await prisma.nftSettings.findFirst();
    const value = row ? { ...NFT_SETTINGS_DEFAULTS, ...row } : NFT_SETTINGS_DEFAULTS;
    nftSettingsCache = { value, expiresAt: Date.now() + NFT_SETTINGS_TTL_MS };
    return value;
  } catch (error) {
    console.error("nft settings read failed, using defaults:", error);
    return NFT_SETTINGS_DEFAULTS;
  }
}

/**
 * One number standing in for "this post did well".
 *
 * Comments are weighted above likes because they cost more effort, and views
 * are divided down so a post cannot qualify on passive impressions alone. All
 * three weights are admin-tunable.
 */
const engagementScore = (post, settings = NFT_SETTINGS_DEFAULTS) => {
  const likes = Array.isArray(post.likes) ? post.likes.length : 0;
  const comments = post._count?.comments ?? 0;
  const views = post.views ?? 0;
  const perPoint = settings.viewsPerPoint > 0 ? settings.viewsPerPoint : 100;
  return (
    likes * settings.likeWeight +
    comments * settings.commentWeight +
    Math.floor(views / perPoint)
  );
};

const toEligibilityEntry = (post, settings) => {
  const score = engagementScore(post, settings);
  return {
    id: post.id,
    _id: post.id,
    text: post.text ?? "",
    type: post.type,
    media: post.media ?? null,
    createdAt: post.createdAt,
    likes: Array.isArray(post.likes) ? post.likes.length : 0,
    comments: post._count?.comments ?? 0,
    views: post.views ?? 0,
    engagementScore: score,
    threshold: settings.engagementThreshold,
    eligible:
      settings.mintingEnabled &&
      score >= settings.engagementThreshold &&
      !post.nftTokenId,
    alreadyMinted: Boolean(post.nftTokenId),
    nftTokenId: post.nftTokenId ?? null,
  };
};

/**
 * @swagger
 * /api/posts/nft-eligible:
 *   get:
 *     tags: [Posts]
 *     summary: The caller's posts, annotated with whether they can be minted as an NFT
 *     security:
 *       - bearerAuth: []
 */
router.get("/nft-eligible", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id || req.userId;
    const includeAll = String(req.query.all || "") === "true";
    const settings = await getNftSettings();

    const posts = await prisma.post.findMany({
      where: { userId, status: "active", communityId: null },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true, text: true, type: true, media: true, views: true,
        likes: true, createdAt: true, nftTokenId: true,
        _count: { select: { comments: true } },
      },
    });

    const annotated = posts.map((post) => toEligibilityEntry(post, settings));

    res.json({
      success: true,
      threshold: settings.engagementThreshold,
      mintingEnabled: settings.mintingEnabled,
      maxRoyaltyBps: settings.maxRoyaltyBps,
      // `all=true` lets the app show near-misses with their progress, which is
      // more useful than an empty list when nothing qualifies yet.
      posts: includeAll ? annotated : annotated.filter((p) => p.eligible),
      eligibleCount: annotated.filter((p) => p.eligible).length,
      totalCount: annotated.length,
    });
  } catch (error) {
    console.error("nft-eligible error:", error);
    res.status(500).json({
      success: false,
      message: "Could not check which posts can become NFTs.",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
});


/**
 * The address a mint is paid from and owned by.
 *
 * Prefers the user's stored `walletAddress` (a linked external wallet), and
 * otherwise derives their custodial address. Returns null when custody is not
 * configured and no wallet is linked, so the caller can answer 503 rather than
 * throwing.
 */
async function resolveMintingAddress(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { walletAddress: true },
  });
  if (user?.walletAddress) return user.walletAddress;

  if (!isCustodyConfigured()) return null;

  const address = getCustodialAddress(userId);
  await prisma.user
    .updateMany({ where: { id: userId }, data: { walletAddress: address } })
    .catch((error) => console.error("wallet address sync failed:", error));
  return address;
}

/**
 * @swagger
 * /api/posts/{postId}/prepare-mint-nft:
 *   post:
 *     tags: [Posts]
 *     summary: Prepare an unsigned transaction minting one of your posts as an NFT
 *     security:
 *       - bearerAuth: []
 */
router.post(
  "/:postId([0-9a-fA-F]{24}|[0-9a-fA-F-]{36})/prepare-mint-nft",
  authMiddleware,
  async (req, res) => {
  try {
    const userId = req.user.id || req.userId;
    const { postId } = req.params;
    const { collectionAccount, royaltyBps } = req.body || {};

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true, userId: true, text: true, type: true, media: true,
        views: true, likes: true, createdAt: true, nftTokenId: true,
        _count: { select: { comments: true } },
      },
    });

    if (!post) return res.status(404).json({ success: false, message: "Post not found" });
    if (post.userId !== userId) {
      return res.status(403).json({ success: false, message: "You can only mint your own posts" });
    }
    if (post.nftTokenId) {
      return res.status(400).json({
        success: false,
        message: "This post has already been minted as an NFT.",
        code: "ALREADY_MINTED",
        nftTokenId: post.nftTokenId,
      });
    }

    const settings = await getNftSettings();

    if (!settings.mintingEnabled) {
      return res.status(403).json({
        success: false,
        message: "Turning posts into NFTs is currently switched off.",
        code: "MINTING_DISABLED",
      });
    }

    const score = engagementScore(post, settings);
    if (score < settings.engagementThreshold) {
      return res.status(400).json({
        success: false,
        message: `This post needs ${settings.engagementThreshold} engagement points to become an NFT. It has ${score}.`,
        code: "NOT_ELIGIBLE",
        engagementScore: score,
        threshold: settings.engagementThreshold,
      });
    }

    const creator = await resolveMintingAddress(userId);
    if (!creator) {
      return res.status(503).json({
        success: false,
        message: "Wallet services are temporarily unavailable. Please try again shortly.",
        code: "CUSTODY_UNAVAILABLE",
      });
    }

    // The chain team's dedicated `MintPostAsNft` instruction is not in the SDK
    // yet (see aeko_chain_implement.md). Until it ships, the post is minted
    // through the standard token-721 path with the post recorded in metadata,
    // which produces a real, tradeable NFT that points back at the post.
    const collection = collectionAccount || creator;
    const tokenId    = Date.now();
    const tokenSeed  = `post:${postId}`.slice(0, 32);
    const tokenAccount = deriveWithSeed(creator, tokenSeed, PROGRAM_IDS.TOKEN_721);

    const firstMedia = Array.isArray(post.media) ? post.media[0] : post.media;
    const metadata = {
      name: (post.text || "Aeko post").trim().slice(0, 32) || "Aeko post",
      symbol: "AEKO",
      uri: typeof firstMedia === "string" ? firstMedia : "",
      attributes: [
        { trait_type: "postId", value: postId },
        { trait_type: "engagementScore", value: String(score) },
        { trait_type: "mintedAt", value: new Date().toISOString() },
      ],
    };

    const space    = estimateTokenAccountSpace({ metadata });
    const lamports = await getMinBalanceForRentExemption(connection, space);
    const blockhash = await connection.getLatestBlockhash();

    const txBase64 = buildPreparedMintWithAccountSetupTransaction({
      payer: creator, recentBlockhash: blockhash, tokenAddress: tokenAccount,
      base: creator, tokenSeed, lamports, space, collection,
      authority: creator, owner: creator, tokenId,
      // Capped by the admin setting so a creator cannot list an NFT with a
      // royalty above the platform limit.
      royaltyBps: Math.min(settings.maxRoyaltyBps, Math.max(0, Number(royaltyBps) || 0)),
      metadata,
    });

    res.json({ success: true, txBase64, tokenAccount, tokenId, metadata, engagementScore: score });
  } catch (error) {
    console.error("prepare-mint-nft error:", error);
    sendChainError(res, error, "Failed to prepare the mint transaction");
  }
});

router.get("/user/bookmarks", authMiddleware, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const userId = req.user.id || req.user._id;

        const [bookmarks, total] = await Promise.all([
            prisma.bookmark.findMany({
                where: { userId },
                skip,
                take: limit,
                orderBy: { savedAt: 'desc' },
                include: {
                    post: {
                        include: {
                            users_posts_userIdTouser: {
                                select: { username: true, name: true, profilePicture: true, blueTick: true, goldenTick: true, prideTick: true, businessTick: true }
                            }
                        }
                    }
                }
            }),
            prisma.bookmark.count({ where: { userId } })
        ]);

        const posts = bookmarks.map(b => {
            if (!b.post) return null;
            return {
                ...b.post,
                user: b.post.users_posts_userIdTouser,
                users_posts_userIdTouser: undefined
            };
        }).filter(p => p);

        res.status(200).json({
            posts,
            pagination: {
                total,
                page,
                pages: Math.ceil(total / limit),
                limit
            }
        });

    } catch (error) {
        console.error("Get Bookmarks Error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Get liked posts
router.get("/user/liked", authMiddleware, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const userId = req.user.id || req.user._id;

        // Find posts where likes array contains userId
        const where = {
            likes: {
                array_contains: userId
            }
        };

        const [posts, total] = await Promise.all([
            prisma.post.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    users_posts_userIdTouser: { select: { name: true, email: true, username: true, profilePicture: true, blueTick: true, goldenTick: true, prideTick: true, businessTick: true } }
                }
            }),
            prisma.post.count({ where })
        ]);

        const mappedPosts = posts.map(post => ({
            ...post,
            user: post.users_posts_userIdTouser,
            users_posts_userIdTouser: undefined
        }));

        res.status(200).json({
            posts: mappedPosts,
            pagination: {
                total,
                page,
                pages: Math.ceil(total / limit),
                limit
            }
        });

    } catch (error) {
        console.error("Get Liked Posts Error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Create Post
router.post("/create", authMiddleware, 
  (req, res, next) => {
    upload.array("media", 10)(req, res, (err) => {
      if (err) {
        const status = err.name === 'MulterError' ? 400 : 500;
        return res.status(status).json({ error: err.message || 'Upload failed' });
      }
      next();
    });
  },
  async (req, res) => {
  try {
    const userId = req.userId || req.user?.id || req.user?._id;
    const { text = "", type: rawType, privacy = "public", selectedUsers: rawSelectedUsers } = req.body;

    let type = rawType;
    if (!type) {
      const file = req.files?.[0] || req.file;
      if (file?.mimetype?.startsWith('image/')) type = 'image';
      else if (file?.mimetype?.startsWith('video/')) type = 'video';
      else type = 'text';
    }

    if (!['text', 'image', 'video'].includes(type)) {
      return res.status(400).json({ error: "Invalid type. Must be one of: text, image, video" });
    }

    if ((type === 'image' || type === 'video') && (!req.files || req.files.length === 0) && !req.file) {
      return res.status(400).json({ error: "Media file is required for image/video posts" });
    }

    const validPrivacyLevels = ['public', 'followers', 'select_users', 'only_me'];
    if (!validPrivacyLevels.includes(privacy)) {
      return res.status(400).json({ error: "Invalid privacy level" });
    }

    let selectedUsers = [];
    if (privacy === 'select_users') {
      if (!rawSelectedUsers) return res.status(400).json({ error: "selectedUsers is required" });
      try {
        selectedUsers = JSON.parse(rawSelectedUsers);
        if (!Array.isArray(selectedUsers) || selectedUsers.length === 0) {
            return res.status(400).json({ error: "selectedUsers must be a non-empty array" });
        }
      } catch (e) {
        return res.status(400).json({ error: "selectedUsers must be a valid JSON array" });
      }
    }

    const mediaPaths = req.files && req.files.length > 0 
      ? req.files.map(f => f.path) 
      : (req.file ? [req.file.path] : []);
      
    // If multiple files, store as array. If single file, store as string (for backward compatibility)
    const mediaData = mediaPaths.length > 1 ? mediaPaths : (mediaPaths[0] || "");

    const postData = {
      userId,
      type,
      text,
      media: mediaData,
      privacy: {
        level: privacy,
        selectedUsers: privacy === 'select_users' ? selectedUsers : [],
        updatedAt: new Date(),
        updateHistory: [{
          previousLevel: null,
          newLevel: privacy,
          updatedAt: new Date(),
          updatedBy: userId
        }]
      }
    };

    const newPost = await prisma.post.create({
        data: postData,
        include: {
            users_posts_userIdTouser: {
                select: { name: true, email: true, username: true, profilePicture: true, blueTick: true, goldenTick: true, prideTick: true, businessTick: true }
            }
        }
    });
    
    // Process mentions in post text
    try {
        const { processMentions } = await import('../services/notificationService.js');
        await processMentions({
            text,
            senderId: userId,
            entityId: newPost.id,
            entityType: 'POST'
        });
    } catch (notifError) {
        console.error('Failed to process mentions:', notifError);
    }

    res.status(201).json({
      ...newPost,
      likesCount: 0,
      commentsCount: 0
    });
  } catch (error) {
    res.status(500).json({ error: process.env.NODE_ENV === "production" ? undefined : error.message });
  }
});

// Edit Post
router.put("/:postId", authMiddleware, async (req, res) => {
  try {
    const { postId } = req.params;
    const { text } = req.body;
    const userId = req.user.id || req.user._id;

    const post = await prisma.post.findUnique({ where: { id: postId } });

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    if (post.userId !== userId) {
      return res.status(403).json({ error: "Not authorized to edit this post" });
    }

    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: {
        text: text !== undefined ? text : post.text
      },
      include: {
        users_posts_userIdTouser: {
            select: { name: true, email: true, username: true, profilePicture: true, blueTick: true, goldenTick: true, prideTick: true, businessTick: true }
        }
      }
    });
    
    // Process mentions if text changed
    if (text && text !== post.text) {
        try {
            const { processMentions } = await import('../services/notificationService.js');
            await processMentions({
                text,
                senderId: userId,
                entityId: updatedPost.id,
                entityType: 'POST'
            });
        } catch (notifError) {
            console.error('Failed to process mentions on edit:', notifError);
        }
    }

    res.json({
        success: true,
        message: "Post updated successfully",
        post: {
            ...updatedPost,
            user: updatedPost.users_posts_userIdTouser,
            users_posts_userIdTouser: undefined
        }
    });

  } catch (error) {
    console.error("Edit Post Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update Privacy
router.put("/:postId/privacy", authMiddleware, async (req, res) => {
  try {
    const { postId } = req.params;
    if (!isValidId(postId)) return res.status(400).json({ error: "Invalid postId format" });

    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) return res.status(404).json({ error: "Post not found" });

    const userId = req.userId || req.user?.id || req.user?._id;
    
    if (post.userId !== userId) {
      return res.status(403).json({ error: "Not authorized to update privacy for this post" });
    }

    const { privacy, selectedUsers = [] } = req.body;
    const validPrivacyLevels = ['public', 'followers', 'select_users', 'only_me'];
    if (!privacy || !validPrivacyLevels.includes(privacy)) {
      return res.status(400).json({ error: "Invalid privacy level" });
    }

    if (privacy === 'select_users' && (!Array.isArray(selectedUsers) || selectedUsers.length === 0)) {
        return res.status(400).json({ error: "selectedUsers is required" });
    }

    const currentPrivacy = post.privacy || {};
    const updateHistory = currentPrivacy.updateHistory || [];
    
    updateHistory.push({
        previousLevel: currentPrivacy.level,
        newLevel: privacy,
        updatedAt: new Date(),
        updatedBy: userId
    });

    const newPrivacy = {
        level: privacy,
        selectedUsers: privacy === 'select_users' ? selectedUsers : [],
        updatedAt: new Date(),
        updateHistory
    };

    const updatedPost = await prisma.post.update({
        where: { id: postId },
        data: { privacy: newPrivacy },
        include: {
            users_posts_userIdTouser: { select: { name: true, email: true, username: true, profilePicture: true, blueTick: true, goldenTick: true, prideTick: true, businessTick: true } }
        }
    });

    res.json({
      success: true,
      message: "Privacy settings updated successfully",
      post: withAuthor(updatedPost)
    });

  } catch (error) {
    console.error('Privacy update error:', error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Search posts
router.get("/search", authMiddleware, async (req, res) => {
    try {
        const { q, page = 1, limit = 20 } = req.query;
        if (!q) return res.status(400).json({ error: "Search query is required" });

        const requestingUserId = req.user.id || req.user._id;
        const privacyWhere = await getPrivacyWhereClause(requestingUserId);
        
        const posts = await prisma.post.findMany({
            where: {
                AND: [
                    { text: { contains: q, mode: 'insensitive' } },
                    // Search deliberately surfaces community posts — it returns the
                    // community alongside each hit — but nothing stopped a *private*
                    // community's posts appearing in a stranger's search results.
                    {
                        OR: [
                            { communityId: null },
                            { communities: { isPrivate: false } }
                        ]
                    },
                    privacyWhere
                ]
            },
            include: {
                users_posts_userIdTouser: { select: { name: true, email: true, username: true, profilePicture: true, blueTick: true, goldenTick: true, prideTick: true, businessTick: true } },
                communities: { select: { id: true, name: true } }
            },
            orderBy: { createdAt: 'desc' },
            take: parseInt(limit),
            skip: (parseInt(page) - 1) * parseInt(limit)
        });

        const mappedPosts = posts.map(post => ({
            ...post,
            user: post.users_posts_userIdTouser,
            users_posts_userIdTouser: undefined
        }));

        res.json(mappedPosts);
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: process.env.NODE_ENV === "production" ? undefined : error.message });
    }
});

/**
 * Hashtag suggestions for the explore search.
 *
 * This endpoint did not exist. The app calls it as one of three parallel
 * requests behind explore search, so its 404 rejected the whole `Promise.all`
 * and the entire search — users and posts included — returned nothing.
 *
 * There is no hashtag table: hashtags live inside `Post.text`, so matching posts
 * are pulled and the tags counted. The candidate set is bounded, which is fine
 * for a type-ahead and avoids scanning every post ever written.
 */
router.get("/hashtags", authMiddleware, async (req, res) => {
  try {
    const q = String(req.query.q || "").trim().replace(/^#/, "");
    const limit = Math.min(25, Math.max(1, Number(req.query.limit) || 10));

    if (!q) {
      return res.json({ success: true, hashtags: [] });
    }

    const posts = await prisma.post.findMany({
      where: {
        status: "active",
        text: { contains: `#${q}`, mode: "insensitive" },
      },
      select: { text: true },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    // Unicode-aware so non-Latin hashtags are not silently dropped.
    const HASHTAG = /#([\p{L}\p{N}_]+)/gu;
    const needle = q.toLowerCase();
    const counts = new Map();

    for (const post of posts) {
      for (const match of (post.text || "").matchAll(HASHTAG)) {
        const tag = match[1];
        const key = tag.toLowerCase();
        if (!key.startsWith(needle)) continue;
        const existing = counts.get(key);
        // Keep the first spelling seen so casing stays natural in the UI.
        if (existing) existing.postCount += 1;
        else counts.set(key, { name: tag, postCount: 1 });
      }
    }

    const hashtags = [...counts.values()]
      .sort((a, b) => b.postCount - a.postCount || a.name.localeCompare(b.name))
      .slice(0, limit);

    res.json({ success: true, hashtags });
  } catch (error) {
    console.error("Hashtag search error:", error);
    res.status(500).json({
      success: false,
      message: "Could not load hashtags.",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
});


// Feed
router.get("/feed", authMiddleware, async (req, res) => {
    try {
        const requestingUserId = req.user.id || req.user._id;
        const privacyWhere = await getPrivacyWhereClause(requestingUserId);
        
        const user = await prisma.user.findUnique({
            where: { id: requestingUserId },
            select: { following: true, notInterested: true }
        });
        const followingIds = Array.isArray(user?.following) ? user.following : [];

        // Filter out not interested posts
        const notInterested = user?.notInterested || {};
        const excludedPostIds = Array.isArray(notInterested.posts) ? notInterested.posts : [];
        const notInExcluded = { id: { notIn: excludedPostIds } };

        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
        const skip = (page - 1) * limit;

        const postInclude = {
            users_posts_userIdTouser: { select: { name: true, email: true, username: true, profilePicture: true, blueTick: true, goldenTick: true, prideTick: true, businessTick: true } },
            _count: { select: { comments: true } }
        };

        // Two tiers: posts from people you follow come first, then everyone
        // else fills the remainder. Each tier is strictly newest-first.
        //
        // The original code did this by fetching both and concatenating —
        // `[...followedPosts, ...otherPosts]` — which was never sorted as a
        // whole and ignored page/limit entirely, so the same 50 rows came back
        // in a fixed, arbitrary-looking order on every request.
        //
        // Paginating across two tiers means treating them as one list: the
        // followed tier occupies positions 0..followedTotal-1, and the rest
        // continues from there. Counting the followed tier first is what lets a
        // page land in the right place without ever repeating or skipping a post.
        // A post made inside a community belongs to that community's own feed,
        // not the main one. Neither tier excluded them, so posting to a community
        // also published to everybody's home feed.
        const notCommunityPost = { communityId: null };

        const followedWhere = followingIds.length
            ? {
                AND: [
                    privacyWhere,
                    notInExcluded,
                    notCommunityPost,
                    { userId: { in: followingIds } }
                ]
            }
            : null;
        const othersWhere = {
            AND: [
                privacyWhere,
                notInExcluded,
                notCommunityPost,
                ...(followingIds.length ? [{ userId: { notIn: followingIds } }] : [])
            ]
        };

        const followedTotal = followedWhere
            ? await prisma.post.count({ where: followedWhere })
            : 0;

        let allPosts = [];

        if (skip < followedTotal) {
            allPosts = await prisma.post.findMany({
                where: followedWhere,
                include: postInclude,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit
            });

            // Followed posts ran out part-way through this page, so top it up
            // from everyone else, starting at their beginning.
            if (allPosts.length < limit) {
                const fill = await prisma.post.findMany({
                    where: othersWhere,
                    include: postInclude,
                    orderBy: { createdAt: 'desc' },
                    take: limit - allPosts.length
                });
                allPosts = [...allPosts, ...fill];
            }
        } else {
            // Entirely past the followed tier; continue through the rest.
            allPosts = await prisma.post.findMany({
                where: othersWhere,
                include: postInclude,
                orderBy: { createdAt: 'desc' },
                skip: skip - followedTotal,
                take: limit
            });
        }

        // Map relation back to 'user' for frontend compatibility
        const mappedPosts = allPosts.map(post => {
            const likes = Array.isArray(post.likes) ? post.likes : [];
            
            // Map media field to mediaUrl/mediaUrls for frontend compatibility
            let mediaUrl = null;
            let mediaUrls = [];
            
            if (post.media) {
                if (typeof post.media === 'string' && post.media.length > 0) {
                    mediaUrl = post.media;
                    mediaUrls = [post.media];
                } else if (Array.isArray(post.media) && post.media.length > 0) {
                     // Check if array elements are strings or objects
                     if (typeof post.media[0] === 'string') {
                         mediaUrls = post.media;
                         mediaUrl = post.media[0];
                     } else if (typeof post.media[0] === 'object' && post.media[0].url) {
                         // Extract URLs from objects
                         mediaUrls = post.media.map(m => m.url).filter(url => url);
                         mediaUrl = mediaUrls[0] || null;
                     } else {
                         // Fallback for mixed or unknown array content
                         mediaUrls = post.media;
                         mediaUrl = post.media[0];
                     }
                } else if (typeof post.media === 'object' && post.media !== null) {
                     // Handle case where media might be a JSON object with url property
                     if (post.media.url) {
                         mediaUrl = post.media.url;
                         mediaUrls = [post.media.url];
                     } else {
                         // Fallback: try to find any string property that looks like a URL
                         const values = Object.values(post.media);
                         const url = values.find(v => typeof v === 'string' && (v.startsWith('http') || v.startsWith('/')));
                         if (url) {
                             mediaUrl = url;
                             mediaUrls = [url];
                         }
                     }
                }
            }

            return {
                ...post,
                user: post.users_posts_userIdTouser,
                users_posts_userIdTouser: undefined,
                likesCount: likes.length,
                commentsCount: post._count?.comments || 0,
                isLiked: likes.includes(requestingUserId),
                media: mediaUrls.length > 1 ? mediaUrls : mediaUrl,
                mediaUrl,
                mediaUrls,
                views: post.views,
                type: ((post.type === 'image' || post.type === 'video') && !mediaUrl) ? 'text' : post.type
            };
        });
        
        res.json(mappedPosts);
    } catch (error) {
        console.error('Feed error:', error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Get single post
// The param is constrained to an id shape (UUID or legacy ObjectId).
// Express matches in declaration order, so an unconstrained "/:postId" swallowed
// every literal path declared below it — `/mixed` and `/videos` both resolved
// here and 404'd as "Post not found". `/videos` is what the reels feed calls.
router.get("/:postId([0-9a-fA-F]{24}|[0-9a-fA-F-]{36})", authMiddleware, async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.userId || req.user?.id || req.user?._id;

        const post = await prisma.post.findUnique({
            where: { id: postId },
            include: {
                users_posts_userIdTouser: { select: { id: true, username: true, profilePicture: true, name: true, blueTick: true, goldenTick: true, prideTick: true, businessTick: true } }
            }
        });
        
        if (!post) return res.status(404).json({ error: "Post not found" });

        // Check blocking
        const canInteract = await BlockingService.enforceBlockingRules(userId, post.userId);
        if (!canInteract) {
             return res.status(404).json({ error: "Post not found" }); // Hide existence
        }

        // Increment views
        await prisma.post.update({
            where: { id: postId },
            data: { views: { increment: 1 } }
        });
        post.views = (post.views || 0) + 1;

        // Map media field
        let mediaUrl = null;
        let mediaUrls = [];
        
        if (post.media) {
            if (typeof post.media === 'string' && post.media.length > 0) {
                mediaUrl = post.media;
                mediaUrls = [post.media];
            } else if (Array.isArray(post.media) && post.media.length > 0) {
                    // Check if array elements are strings or objects
                    if (typeof post.media[0] === 'string') {
                        mediaUrls = post.media;
                        mediaUrl = post.media[0];
                    } else if (typeof post.media[0] === 'object' && post.media[0].url) {
                        // Extract URLs from objects
                        mediaUrls = post.media.map(m => m.url).filter(url => url);
                        mediaUrl = mediaUrls[0] || null;
                    } else {
                        // Fallback
                        mediaUrls = post.media;
                        mediaUrl = post.media[0];
                    }
            } else if (typeof post.media === 'object' && post.media !== null) {
                    if (post.media.url) {
                        mediaUrl = post.media.url;
                        mediaUrls = [post.media.url];
                    } else {
                        const values = Object.values(post.media);
                        const url = values.find(v => typeof v === 'string' && (v.startsWith('http') || v.startsWith('/')));
                        if (url) {
                            mediaUrl = url;
                            mediaUrls = [url];
                        }
                    }
            }
        }

        res.json({
            ...post,
            user: post.users_posts_userIdTouser,
            users_posts_userIdTouser: undefined,
            media: mediaUrls.length > 1 ? mediaUrls : mediaUrl,
            mediaUrl,
            mediaUrls,
            type: ((post.type === 'image' || post.type === 'video') && !mediaUrl) ? 'text' : post.type
        });
    } catch (error) {
        res.status(500).json({ error: process.env.NODE_ENV === "production" ? undefined : error.message });
    }
});

// Like/Unlike a post
router.post("/:postId/view", authMiddleware, async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.user.id || req.user._id;

        const post = await prisma.post.findUnique({ where: { id: postId } });
        if (!post) {
            return res.status(404).json({ message: "Post not found" });
        }

        // Check blocking
        const canInteract = await BlockingService.enforceBlockingRules(userId, post.userId);
        if (!canInteract) {
             return res.status(404).json({ error: "Post not found" });
        }

        const updatedPost = await prisma.post.update({
            where: { id: postId },
            data: { views: { increment: 1 } }
        });

        res.json({
            success: true,
            views: updatedPost.views
        });
    } catch (error) {
        console.error("View Post Error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

router.post("/:postId/like", authMiddleware, async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.user.id || req.user._id;

        const post = await prisma.post.findUnique({ where: { id: postId } });
        if (!post) {
            return res.status(404).json({ message: "Post not found" });
        }

        // Check blocking
        const canInteract = await BlockingService.enforceBlockingRules(userId, post.userId);
        if (!canInteract) {
             return res.status(404).json({ error: "Post not found" });
        }

        let likes = Array.isArray(post.likes) ? post.likes : [];
        const isLiked = likes.includes(userId);
        
        if (isLiked) {
            // Unlike
            likes = likes.filter(id => id !== userId);
        } else {
            // Like
            likes.push(userId);
            
            // Create notification for like
            const { createNotification } = await import('../services/notificationService.js');
            // Get user info for notification message
            const user = await prisma.user.findUnique({ where: { id: userId }, select: { username: true, name: true } });
            
            await createNotification({
                recipientId: post.userId,
                senderId: userId,
                type: 'LIKE',
                title: 'New Like',
                message: `${user?.username || user?.name || 'Someone'} liked your post`,
                entityId: postId,
                entityType: 'POST',
                metadata: {
                    postImage: post.media?.[0]?.url // Include thumbnail if available
                }
            });
        }

        const totalLikes = likes.length;
        const currentEngagement = post.engagement || {};

        const updatedPost = await prisma.post.update({
            where: { id: postId },
            data: {
                likes: likes,
                engagement: {
                    ...currentEngagement,
                    totalLikes
                }
            }
        });

        return res.status(200).json({
            message: isLiked ? "Post unliked successfully" : "Post liked successfully",
            liked: !isLiked,
            totalLikes,
            post: updatedPost
        });

    } catch (error) {
        console.error("Like Post Error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Get reposts
router.get("/:postId([0-9a-fA-F]{24}|[0-9a-fA-F-]{36})/reposts", authMiddleware, async (req, res) => {
  try {
    const { postId } = req.params;
    const reposts = await prisma.post.findMany({
        where: { originalPostId: postId },
        include: {
            users_posts_userIdTouser: { select: { name: true, email: true, username: true, profilePicture: true, blueTick: true, goldenTick: true, prideTick: true, businessTick: true } }
        },
        orderBy: { createdAt: 'desc' }
    });
    res.json(reposts.map(withAuthor));
  } catch (error) {
    res.status(500).json({ error: process.env.NODE_ENV === "production" ? undefined : error.message });
  }
});

// Share to status
router.post("/:postId/share-to-status", authMiddleware, async (req, res) => {
  try {
    const { postId } = req.params;
    const originalPost = await prisma.post.findUnique({ 
        where: { id: postId },
        include: { users_posts_userIdTouser: { select: { username: true, profilePicture: true, name: true, blueTick: true, goldenTick: true, prideTick: true, businessTick: true } } }
    });
    if (!originalPost) return res.status(404).json({ error: "Post not found" });

    const userId = req.userId || req.user?.id || req.user?._id;
    // Basic access check (assuming public or owner for simplicity, or implement privacy check)
    // For now, allow sharing.

    const { additionalContent = '' } = req.body;
    
    // Map the awkward Prisma relation name to a cleaner object for storage
    const creator = originalPost.users_posts_userIdTouser || {};

    // Create status
    const sharedStatus = await prisma.status.create({
        data: {
            userId,
            type: 'shared_post',
            content: additionalContent,
            sharedPostId: postId,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
            originalContent: {
                creator: creator,
                post: originalPost
            }
        },
        include: {
            users: { select: { username: true, profilePicture: true, blueTick: true, goldenTick: true, prideTick: true, businessTick: true } }
        }
    });

    res.status(201).json({
      success: true,
      message: "Post shared to status successfully",
      status: {
          ...sharedStatus,
          user: sharedStatus.users, // Map for frontend consistency
          users: undefined
      }
    });

  } catch (error) {
    console.error('Share to status error:', error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Promote post
router.post("/:postId/promote", authMiddleware, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id || req.user._id;
    
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) return res.status(404).json({ error: "Post not found" });

    if (post.userId !== userId) {
      return res.status(403).json({ error: "Not authorized to promote this post" });
    }

    const { budget, target, startDate, endDate } = req.body;
    
    const currentAd = post.ad || {};
    const newAd = {
        ...currentAd,
        isPromoted: true,
        budget: budget !== undefined ? Number(budget) : currentAd.budget,
        target: target || currentAd.target,
        startDate: startDate ? new Date(startDate) : currentAd.startDate,
        endDate: endDate ? new Date(endDate) : currentAd.endDate
    };

    const updatedPost = await prisma.post.update({
        where: { id: postId },
        data: { ad: newAd }
    });

    res.json({ success: true, post: updatedPost });
  } catch (error) {
    res.status(500).json({ error: process.env.NODE_ENV === "production" ? undefined : error.message });
  }
});

// Get user posts
router.get("/user/:userId", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const requestingUserId = req.user.id || req.user._id;
    const page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 20; // Increased default limit
    if (limit > 100) limit = 100; // Cap limit
    const skip = (page - 1) * limit;
    
    // Check blocking
    const canInteract = await BlockingService.enforceBlockingRules(requestingUserId, userId);
    if (!canInteract) {
         return res.status(404).json({ error: "User not found" }); // Hide existence
    }

    // The profile's Media and Texts tabs have always sent `?type=media|text`,
    // but this handler never read it — both tabs ran the same unfiltered query,
    // so text posts appeared in the media grid.
    //
    // `Post.type` is the post's declared kind: "text", "image" or "video".
    const requestedType = String(req.query.type || '').toLowerCase();
    const typeWhere =
      requestedType === 'media'
        ? { type: { in: ['image', 'video'] } }
        : requestedType === 'text'
          ? { type: 'text' }
          : {};

    // Privacy check logic
    const privacyWhere = await getPrivacyWhereClause(requestingUserId);
    
    const where = {
        AND: [
            { userId: userId },
            typeWhere,
            privacyWhere
        ]
    };

    // If viewing own profile, skip privacy check (already covered by OR logic but to be safe/optimized)
    if (userId === requestingUserId) {
         // simplified query for own posts
         const ownWhere = { userId, ...typeWhere };
         const [posts, total] = await Promise.all([
             prisma.post.findMany({
                 where: ownWhere,
                 skip,
                 take: limit,
                 include: {
            users_posts_userIdTouser: {
                select: { name: true, email: true, username: true, profilePicture: true, blueTick: true, goldenTick: true, prideTick: true, businessTick: true }
            }
        },
                 orderBy: { createdAt: 'desc' }
             }),
             // Counted with the same filter, or the tab's pagination would be
             // computed from every post the user has ever made.
             prisma.post.count({ where: ownWhere })
         ]);

         const mappedPosts = posts.map(post => ({
             ...post,
             user: post.users_posts_userIdTouser,
             users_posts_userIdTouser: undefined
         }));

         return res.json({
            posts: mappedPosts,
            pagination: {
                total,
                page,
                pages: Math.ceil(total / limit),
                limit
            }
         });
    }

    const [posts, total] = await Promise.all([
        prisma.post.findMany({
            where,
            skip,
            take: limit,
            include: {
                users_posts_userIdTouser: { select: { name: true, email: true, username: true, profilePicture: true, blueTick: true, goldenTick: true, prideTick: true, businessTick: true } }
            },
            orderBy: { createdAt: 'desc' }
        }),
        prisma.post.count({ where })
    ]);
    
    const mappedPosts = posts.map(post => ({
        ...post,
        user: post.users_posts_userIdTouser,
        users_posts_userIdTouser: undefined
    }));

    res.json({
        posts: mappedPosts,
        pagination: {
            total,
            page,
            pages: Math.ceil(total / limit),
            limit
        }
    });
  } catch (error) {
    console.error('User posts endpoint error:', error);
    res.status(500).json({ error: process.env.NODE_ENV === "production" ? undefined : error.message });
  }
});

// Get mixed media posts
router.get("/mixed", authMiddleware, async (req, res) => {
  try {
    const requestingUserId = req.user.id || req.user._id;
    const privacyWhere = await getPrivacyWhereClause(requestingUserId);
    
    const posts = await prisma.post.findMany({
        where: {
            AND: [
                { type: { in: ["image", "video"] } },
                // Community posts belong to their community, not the public feed.
                { communityId: null },
                privacyWhere
            ]
        },
        include: {
            users_posts_userIdTouser: { select: { name: true, email: true, username: true, profilePicture: true, blueTick: true, goldenTick: true, prideTick: true, businessTick: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
    });
    
    res.json(posts.map(withAuthor));
  } catch (error) {
    res.status(500).json({ error: process.env.NODE_ENV === "production" ? undefined : error.message });
  }
});

// Get videos
router.get("/videos", authMiddleware, async (req, res) => {
  try {
    const { effect } = req.query;
    // Paginated so a reels list can scroll past the first batch; previously it
    // always returned the same 50 rows.
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const requestingUserId = req.user.id || req.user._id;
    
    const effectMap = {
      grayscale: 'e_grayscale',
      reverse: 'e_reverse',
      loop: 'e_loop:2',
      accelerate: 'e_accelerate:50',
    };
    const transformation = effectMap[effect] || null;

    const privacyWhere = await getPrivacyWhereClause(requestingUserId);

    const posts = await prisma.post.findMany({
        where: {
            AND: [
                { type: "video" },
                // Keeps a community's videos out of the public reels feed.
                { communityId: null },
                privacyWhere
            ]
        },
        include: {
            users_posts_userIdTouser: { select: { name: true, email: true, username: true, profilePicture: true, blueTick: true, goldenTick: true, prideTick: true, businessTick: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 50
    });

    if (!transformation) {
      return res.json(posts.map(withAuthor));
    }

    const transformed = posts.map((p) => {
      const obj = { ...withAuthor(p) };
      obj.media = transformCloudinaryUrl(obj.media, transformation);
      return obj;
    });

    res.json(transformed);
  } catch (error) {
    res.status(500).json({ error: process.env.NODE_ENV === "production" ? undefined : error.message });
  }
});

// Repost
router.post("/repost/:postId", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { postId } = req.params;
    
    const originalPost = await prisma.post.findUnique({ where: { id: postId } });
    if (!originalPost) return res.status(404).json({ error: "Post not found" });

    const newRepost = await prisma.post.create({
        data: {
            userId,
            originalPostId: originalPost.id,
            type: originalPost.type,
            text: originalPost.text || "",
            media: originalPost.media || ""
        },
        include: {
            users_posts_userIdTouser: { select: { name: true, email: true, username: true, profilePicture: true, blueTick: true, goldenTick: true, prideTick: true, businessTick: true } }
        }
    });

    res.status(201).json({
      ...withAuthor(newRepost),
      likesCount: 0,
      commentsCount: 0
    });
  } catch (error) {
    res.status(500).json({ error: process.env.NODE_ENV === "production" ? undefined : error.message });
  }
});

router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id || req.user._id;

    const post = await prisma.post.findUnique({ where: { id } });
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    if (post.userId !== userId) {
      return res.status(403).json({ error: "Not authorized to delete this post" });
    }

    await prisma.post.delete({ where: { id } });

    res.json({ success: true, message: "Post deleted successfully" });
  } catch (error) {
    console.error("Delete post error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @swagger
 * /api/posts/{postId}/anchor:
 *   post:
 *     tags: [Blockchain]
 *     summary: Anchor a post on-chain
 *     description: |
 *       Hashes the post content server-side and returns an unsigned transaction.
 *       Sign with your wallet key and submit directly to the Aeko RPC.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [creatorAddress]
 *             properties:
 *               creatorAddress:
 *                 type: string
 *                 description: Creator's on-chain wallet address
 *                 example: "AeKo1234...creator"
 *               contentUri:
 *                 type: string
 *                 description: Optional — IPFS/HTTPS URI. If omitted, backend uploads post content to IPFS automatically.
 *                 example: "ipfs://QmXyz..."
 *     responses:
 *       200:
 *         description: Unsigned anchor transaction — sign with creator key and submit to RPC
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 txBase64: { type: string }
 *                 contentUri: { type: string, description: "IPFS URI used for anchoring" }
 *       400:
 *         description: Already anchored or missing fields
 *       404:
 *         description: Post not found
 *       401:
 *         description: Unauthorized
 */
router.post("/:postId/anchor", authMiddleware, async (req, res) => {
  try {
    const { postId } = req.params;
    const { contentUri, creatorAddress } = req.body;

    if (!creatorAddress) {
      return res.status(400).json({ success: false, message: "creatorAddress is required" });
    }

    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) return res.status(404).json({ success: false, message: "Post not found" });
    if (post.isAnchored) return res.status(400).json({ success: false, message: "Post already anchored" });

    // Upload post content to IPFS if no URI yet
    const resolvedContentUri = contentUri ?? await uploadJSON(
      { postId, text: post.text, media: post.media, createdAt: post.createdAt },
      `post_${postId}.json`,
    );

    const blockhash     = await connection.getLatestBlockhash();
    const contentText   = post.text ?? resolvedContentUri;
    const metadataJson  = JSON.stringify({ postId, text: post.text, media: post.media });

    const txBase64 = buildPreparedAnchorPostTransaction({
      payer:           creatorAddress,
      recentBlockhash: blockhash,
      stateAccount:    process.env.SOCIAL_POSTS_STATE_ACCOUNT,
      creator:         creatorAddress,
      postId:          toBase58Hash(postId),
      contentHash:     toBase58Hash(contentText),
      metadataHash:    toBase58Hash(metadataJson),
      contentUri:      resolvedContentUri,
      postKind:        "original",
      visibility:      "public",
      createdAtUnix:   Math.floor(post.createdAt.getTime() / 1000),
    });

    // Store contentUri optimistically so verify can use it after the user submits the tx
    await prisma.post.update({
      where: { id: postId },
      data:  { contentUri: resolvedContentUri },
    });

    res.json({ success: true, txBase64, contentUri: resolvedContentUri });
  } catch (error) {
    console.error("anchor post error:", error);
    res.status(500).json({ success: false, message: "Failed to anchor post" });
  }
});

/**
 * @swagger
 * /api/posts/{postId}/verify:
 *   get:
 *     tags: [Blockchain]
 *     summary: Verify a post's on-chain anchor
 *     description: Checks the DB cache first, then optionally confirms live on the Aeko explorer.
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Verification result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 verified: { type: boolean }
 *                 reason:
 *                   type: string
 *                   description: Present only when verified is false
 *                   example: "not anchored"
 *                 postId: { type: string }
 *                 contentUri: { type: string }
 *                 creator: { type: string }
 *                 createdAtUnix: { type: integer }
 *                 onChainSignature: { type: string }
 *       404:
 *         description: Post not found
 */
/**
 * @swagger
 * /api/posts/{postId}/mint-as-nft:
 *   post:
 *     tags: [Blockchain]
 *     summary: Prepare an unsigned transaction to mint a post as an NFT
 *     description: |
 *       Converts a social post into a Token-721 NFT on the Aeko chain.
 *
 *       **Flow:**
 *       1. `POST /api/posts/:postId/mint-as-nft` → get `txBase64`, `tokenAccount`, `tokenAccountSecretKey`
 *       2. App signs with **both** the user keypair and the `tokenAccountSecretKey`
 *       3. App submits signed tx directly to the Aeko RPC
 *
 *       The post's content is uploaded to IPFS automatically if it hasn't been anchored yet.
 *       The first media asset URL (Cloudinary) is used as `imageUri` — `https://` is valid on-chain.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [collectionAccount, creatorAddress]
 *             properties:
 *               collectionAccount:
 *                 type: string
 *                 description: Collection account to mint the NFT into
 *                 example: "AeKoCollect..."
 *               creatorAddress:
 *                 type: string
 *                 description: Creator's wallet address
 *                 example: "AeKo1234...creator"
 *               royaltyBps:
 *                 type: integer
 *                 description: Royalty in basis points (e.g. 500 = 5%). Defaults to 0.
 *                 example: 500
 *     responses:
 *       200:
 *         description: Unsigned mint transaction
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 txBase64: { type: string, description: "Sign with user key + tokenAccountSecretKey" }
 *                 tokenAccount: { type: string, description: "New token account address (the NFT's on-chain identity)" }
 *                 tokenAccountSecretKey: { type: array, items: { type: integer }, description: "Co-sign bytes for the token account" }
 *                 contentUri: { type: string, description: "IPFS URI used as NFT metadata" }
 *       400:
 *         description: Missing required fields
 *       404:
 *         description: Post not found
 *       401:
 *         description: Unauthorized
 */
router.post("/:postId/mint-as-nft", authMiddleware, async (req, res) => {
  try {
    const { postId } = req.params;
    const { collectionAccount, creatorAddress, royaltyBps } = req.body;

    if (!collectionAccount || !creatorAddress) {
      return res.status(400).json({ success: false, message: "collectionAccount and creatorAddress are required" });
    }

    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) return res.status(404).json({ success: false, message: "Post not found" });

    // Use existing IPFS contentUri from anchoring, or upload fresh metadata JSON
    const contentUri = post.contentUri ?? await uploadJSON(
      { postId, text: post.text, media: post.media, createdAt: post.createdAt },
      `post_${postId}.json`,
    );

    // Use first media asset as imageUri — https:// Cloudinary URLs are valid on-chain
    const mediaUrls = Array.isArray(post.media) ? post.media : [];
    const imageUri  = mediaUrls[0] ?? contentUri;
    const nftName   = (post.text ?? "").slice(0, 32) || `Post ${postId.slice(0, 8)}`;
    const metadata  = { name: nftName, uri: contentUri, imageUri };

    const tokenId      = Date.now();
    const tokenSeed    = `nft:${tokenId}`.slice(0, 32);
    const tokenAccount = deriveWithSeed(creatorAddress, tokenSeed, PROGRAM_IDS.TOKEN_721);
    const space        = estimateTokenAccountSpace({ metadata });
    const lamports     = await getMinBalanceForRentExemption(connection, space);
    const blockhash    = await connection.getLatestBlockhash();

    const txBase64 = buildPreparedMintWithAccountSetupTransaction({
      payer:           creatorAddress,
      recentBlockhash: blockhash,
      tokenAddress:    tokenAccount,
      base:            creatorAddress,
      tokenSeed,
      lamports,
      space,
      collection:      collectionAccount,
      authority:       creatorAddress,
      owner:           creatorAddress,
      tokenId,
      royaltyBps:      royaltyBps ?? 0,
      metadata,
    });

    res.json({ success: true, txBase64, tokenAccount, contentUri });
  } catch (error) {
    console.error("mint-as-nft error:", error);
    res.status(500).json({ success: false, message: "Failed to prepare mint-as-NFT transaction" });
  }
});

router.get("/:postId([0-9a-fA-F]{24}|[0-9a-fA-F-]{36})/verify", async (req, res) => {
  try {
    const { postId } = req.params;

    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) return res.status(404).json({ success: false, message: "Post not found" });

    if (!post.isAnchored) {
      return res.json({ success: true, verified: false, reason: "not anchored" });
    }

    const onChain = await explorer.getPost(postId).catch(() => null);
    if (!onChain) {
      return res.json({ success: true, verified: false, reason: "not found on chain" });
    }

    res.json({
      success: true,
      verified: true,
      postId,
      contentUri: onChain.contentUri,
      creator: onChain.creator,
      createdAtUnix: onChain.createdAtUnix,
      onChainSignature: post.onChainSignature,
    });
  } catch (error) {
    console.error("verify post error:", error);
    res.status(500).json({ success: false, message: "Failed to verify post" });
  }
});

export default router;
