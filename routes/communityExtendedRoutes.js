import express from "express";
import crypto from "crypto";
import { prisma } from "../config/db.js";
import { protect } from "../middleware/authMiddleware.js";
import {
  isCommunityAdmin,
  isCommunityAdminOrModerator,
  isCommunityMember,
  checkPrivateCommunityAccess,
} from "../middleware/communityMiddleware.js";
import { uploadImage } from "../middleware/upload.js";
import { validateCommunityPaymentSettings } from "../middleware/paymentValidation.js";
import { handleValidationErrors } from "../middleware/securityValidation.js";
import { sendError } from "../utils/apiErrors.js";

/**
 * Community endpoints the mobile client already calls.
 *
 * routes/communityRoutes.js covers create/list/get/join/leave/update/delete.
 * Everything the app needs beyond that — posts, rules, members, moderation,
 * invites, settings and follow — had no route at all, so 29 client calls
 * 404'd. They live here rather than in communityRoutes.js to keep that file's
 * controller-based structure intact and this addition reviewable.
 *
 * Mounted on the same /api/communities prefix, after communityRoutes, so the
 * existing routes keep priority.
 *
 * Storage notes:
 *  - Roles and membership state live on CommunityMember (role, status).
 *    Banning and muting are status values, not deletions, so history survives.
 *  - Rules, pinned posts, invites and per-user notification preferences live
 *    under Community.settings (Json), since none has its own model.
 */

const router = express.Router();

/** Reads the Json settings blob defensively — it is nullable and untyped. */
const readSettings = (community) =>
  community?.settings && typeof community.settings === "object"
    ? community.settings
    : {};

async function getSettings(communityId) {
  const community = await prisma.community.findUnique({
    where: { id: communityId },
    select: { settings: true },
  });
  return readSettings(community);
}

async function writeSettings(communityId, mutate) {
  const current = await getSettings(communityId);
  const next = mutate({ ...current });
  await prisma.community.update({
    where: { id: communityId },
    data: { settings: next },
  });
  return next;
}

const userSelect = {
  id: true,
  name: true,
  username: true,
  profilePicture: true,
  blueTick: true,
  goldenTick: true,
};

const currentUserId = (req) => req.user?.id || req.userId || req.user?._id;

// ---------------------------------------------------------------------------
// Profile & settings
// ---------------------------------------------------------------------------

router.get("/:id/profile", protect, checkPrivateCommunityAccess, async (req, res) => {
  try {
    const community = await prisma.community.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        name: true,
        description: true,
        profile: true,
        tags: true,
        isPrivate: true,
        memberCount: true,
        createdAt: true,
        users: { select: userSelect },
      },
    });

    if (!community) return res.status(404).json({ error: "Community not found" });
    res.json({ success: true, community });
  } catch (error) {
    console.error("Get community profile error:", error);
    res.status(500).json({ error: process.env.NODE_ENV === "production" ? undefined : error.message });
  }
});

router.get("/:id/settings", protect, isCommunityAdminOrModerator, async (req, res) => {
  try {
    const settings = await getSettings(req.params.id);
    res.json({ success: true, settings });
  } catch (error) {
    console.error("Get community settings error:", error);
    res.status(500).json({ error: process.env.NODE_ENV === "production" ? undefined : error.message });
  }
});

/**
 * Update community settings.
 *
 * The documented contract (api.md -> "Update community settings") nests
 * everything under a `settings` object, and validateCommunityPaymentSettings
 * validates exactly those paths (settings.payment.price, .currency, ...). The
 * first version of this route merged a FLAT req.body straight into the column,
 * which both mismatched the documented shape and bypassed validation entirely —
 * a paid community could be saved with a negative price or an unsupported
 * currency.
 *
 * Sub-objects are merged one level deep so updating `payment` does not wipe
 * `postSettings`, and vice versa.
 */
router.put(
  "/:id/settings",
  protect,
  isCommunityAdmin,
  validateCommunityPaymentSettings,
  handleValidationErrors,
  async (req, res) => {
    try {
      const incoming = req.body?.settings;
      if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) {
        return res.status(400).json({
          success: false,
          message: "A `settings` object is required"
        });
      }

      const NESTED_KEYS = ["payment", "postSettings"];

      const settings = await writeSettings(req.params.id, (current) => {
        const next = { ...current };

        for (const [key, value] of Object.entries(incoming)) {
          if (NESTED_KEYS.includes(key) && value && typeof value === "object") {
            next[key] = { ...(current[key] ?? {}), ...value };
          } else {
            next[key] = value;
          }
        }
        return next;
      });

      res.json({ success: true, settings });
    } catch (error) {
      return sendError(res, error, "community.settings");
    }
  }
);

/**
 * Update the community profile.
 *
 * Documented shape (api.md -> "Update community profile"): name 3-50,
 * description up to 500, plus optional website and location. Owner or
 * moderators, unlike settings which is owner-only.
 */
router.put(
  "/:id/profile",
  protect,
  isCommunityAdminOrModerator,
  async (req, res) => {
    try {
      const { name, description, website, location } = req.body || {};
      const errors = [];

      if (name !== undefined) {
        const trimmed = String(name).trim();
        if (trimmed.length < 3 || trimmed.length > 50) {
          errors.push("Name must be between 3 and 50 characters");
        }
      }
      if (description !== undefined && String(description).length > 500) {
        errors.push("Description must be 500 characters or fewer");
      }
      if (website !== undefined && String(website).trim()) {
        try {
          new URL(String(website));
        } catch {
          errors.push("Website must be a valid URL");
        }
      }
      if (errors.length) {
        return res.status(400).json({ success: false, message: errors[0], errors });
      }

      const existing = await prisma.community.findUnique({
        where: { id: req.params.id },
        select: { profile: true },
      });
      if (!existing) {
        return res.status(404).json({ success: false, message: "Community not found" });
      }

      // name and description are real columns; website and location live in the
      // profile JSON, which has no schema of its own.
      const data = {};
      if (name !== undefined) data.name = String(name).trim();
      if (description !== undefined) data.description = String(description).trim();

      if (website !== undefined || location !== undefined) {
        const profile =
          existing.profile && typeof existing.profile === "object" && !Array.isArray(existing.profile)
            ? existing.profile
            : {};
        data.profile = {
          ...profile,
          ...(website !== undefined ? { website: String(website).trim() } : {}),
          ...(location !== undefined ? { location: String(location).trim() } : {}),
        };
      }

      if (!Object.keys(data).length) {
        return res.status(400).json({ success: false, message: "No profile fields supplied" });
      }

      const community = await prisma.community.update({
        where: { id: req.params.id },
        data,
        select: {
          id: true,
          name: true,
          description: true,
          profile: true,
        },
      });

      res.json({ success: true, community });
    } catch (error) {
      return sendError(res, error, "community.profile.update");
    }
  },
);

/**
 * Upload the community avatar or cover.
 *
 * The documented field name is `photo` and `type` (avatar|cover) may arrive as
 * a query parameter or a form field. The first version of this route read a
 * field called `image` and only ever checked the body, so a request following
 * the documented shape was rejected as "An image file is required".
 */
router.post(
  "/:id/upload-photo",
  protect,
  isCommunityAdminOrModerator,
  uploadImage.single("photo"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: "A photo file is required" });
      }

      const type = String(req.query.type || req.body?.type || "avatar").toLowerCase();
      if (type !== "avatar" && type !== "cover") {
        return res.status(400).json({ success: false, message: "type must be 'avatar' or 'cover'" });
      }

      // Cloudinary storage puts the hosted URL on path/secure_url.
      const url = req.file.path || req.file.secure_url;
      const field = type === "cover" ? "coverPhoto" : "profilePhoto";

      const community = await prisma.community.findUnique({
        where: { id: req.params.id },
        select: { profile: true },
      });
      if (!community) {
        return res.status(404).json({ success: false, message: "Community not found" });
      }

      const profile =
        community.profile && typeof community.profile === "object" && !Array.isArray(community.profile)
          ? community.profile
          : {};

      await prisma.community.update({
        where: { id: req.params.id },
        data: { profile: { ...profile, [field]: url } },
      });

      res.json({ success: true, photoUrl: url, url, type, field });
    } catch (error) {
      return sendError(res, error, "community.uploadPhoto");
    }
  },
);

// ---------------------------------------------------------------------------
// Follow (distinct from membership: following is a feed subscription)
// ---------------------------------------------------------------------------

router.post("/:id/follow", protect, async (req, res) => {
  try {
    const userId = currentUserId(req);
    const communityId = req.params.id;

    const existing = await prisma.communityFollower.findFirst({
      where: { communityId, userId },
      select: { id: true },
    });
    if (existing) return res.json({ success: true, following: true });

    await prisma.communityFollower.create({ data: { communityId, userId } });
    res.json({ success: true, following: true });
  } catch (error) {
    console.error("Follow community error:", error);
    res.status(500).json({ error: process.env.NODE_ENV === "production" ? undefined : error.message });
  }
});

router.post("/:id/unfollow", protect, async (req, res) => {
  try {
    await prisma.communityFollower.deleteMany({
      where: { communityId: req.params.id, userId: currentUserId(req) },
    });
    res.json({ success: true, following: false });
  } catch (error) {
    console.error("Unfollow community error:", error);
    res.status(500).json({ error: process.env.NODE_ENV === "production" ? undefined : error.message });
  }
});

// ---------------------------------------------------------------------------
// Posts
// ---------------------------------------------------------------------------

router.get("/:id/posts", protect, checkPrivateCommunityAccess, async (req, res) => {
  try {
    const communityId = req.params.id;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));

    const settings = await getSettings(communityId);
    const pinnedIds = Array.isArray(settings.pinnedPostIds) ? settings.pinnedPostIds : [];

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where: { communityId },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: userSelect },
          _count: { select: { comments: true } },
        },
      }),
      prisma.post.count({ where: { communityId } }),
    ]);

    res.json({
      success: true,
      posts: posts.map((post) => ({ ...post, isPinned: pinnedIds.includes(post.id) })),
      pagination: { page, limit, total, hasMore: page * limit < total },
    });
  } catch (error) {
    console.error("Get community posts error:", error);
    res.status(500).json({ error: process.env.NODE_ENV === "production" ? undefined : error.message });
  }
});

router.post("/:id/posts", protect, isCommunityMember, async (req, res) => {
  try {
    const { text, media, privacy } = req.body || {};
    if (!text && !media) {
      return res.status(400).json({ error: "A post needs text or media" });
    }

    const post = await prisma.post.create({
      data: {
        text: text ?? "",
        media: media ?? null,
        userId: currentUserId(req),
        communityId: req.params.id,
        isCommunityPost: true,
        ...(privacy ? { privacy } : {}),
      },
      include: { user: { select: userSelect } },
    });

    res.status(201).json({ success: true, post });
  } catch (error) {
    console.error("Create community post error:", error);
    res.status(500).json({ error: process.env.NODE_ENV === "production" ? undefined : error.message });
  }
});

router.delete("/:id/posts/:postId", protect, isCommunityAdminOrModerator, async (req, res) => {
  try {
    const { id: communityId, postId } = req.params;

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { communityId: true },
    });
    if (!post || post.communityId !== communityId) {
      return res.status(404).json({ error: "Post not found in this community" });
    }

    await prisma.post.delete({ where: { id: postId } });
    await writeSettings(communityId, (current) => ({
      ...current,
      pinnedPostIds: (current.pinnedPostIds ?? []).filter((id) => id !== postId),
    }));

    res.json({ success: true, postId });
  } catch (error) {
    console.error("Delete community post error:", error);
    res.status(500).json({ error: process.env.NODE_ENV === "production" ? undefined : error.message });
  }
});

router.post("/:id/posts/:postId/pin", protect, isCommunityAdminOrModerator, async (req, res) => {
  try {
    const { id: communityId, postId } = req.params;
    const settings = await writeSettings(communityId, (current) => {
      const pinned = new Set(current.pinnedPostIds ?? []);
      pinned.add(postId);
      return { ...current, pinnedPostIds: [...pinned] };
    });
    res.json({ success: true, pinnedPostIds: settings.pinnedPostIds });
  } catch (error) {
    console.error("Pin community post error:", error);
    res.status(500).json({ error: process.env.NODE_ENV === "production" ? undefined : error.message });
  }
});

router.post("/:id/posts/:postId/unpin", protect, isCommunityAdminOrModerator, async (req, res) => {
  try {
    const { id: communityId, postId } = req.params;
    const settings = await writeSettings(communityId, (current) => ({
      ...current,
      pinnedPostIds: (current.pinnedPostIds ?? []).filter((id) => id !== postId),
    }));
    res.json({ success: true, pinnedPostIds: settings.pinnedPostIds });
  } catch (error) {
    console.error("Unpin community post error:", error);
    res.status(500).json({ error: process.env.NODE_ENV === "production" ? undefined : error.message });
  }
});

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

router.get("/:id/rules", protect, checkPrivateCommunityAccess, async (req, res) => {
  try {
    const settings = await getSettings(req.params.id);
    res.json({ success: true, rules: settings.rules ?? [] });
  } catch (error) {
    console.error("Get community rules error:", error);
    res.status(500).json({ error: process.env.NODE_ENV === "production" ? undefined : error.message });
  }
});

router.post("/:id/rules", protect, isCommunityAdmin, async (req, res) => {
  try {
    const { title, description } = req.body || {};
    if (!title || !title.trim()) {
      return res.status(400).json({ error: "A rule title is required" });
    }

    const rule = {
      id: crypto.randomUUID(),
      title: title.trim(),
      description: description?.trim() ?? "",
      createdAt: new Date().toISOString(),
    };

    const settings = await writeSettings(req.params.id, (current) => ({
      ...current,
      rules: [...(current.rules ?? []), rule],
    }));

    res.status(201).json({ success: true, rule, rules: settings.rules });
  } catch (error) {
    console.error("Create community rule error:", error);
    res.status(500).json({ error: process.env.NODE_ENV === "production" ? undefined : error.message });
  }
});

router.put("/:id/rules/:ruleId", protect, isCommunityAdmin, async (req, res) => {
  try {
    const { ruleId } = req.params;
    const { title, description } = req.body || {};

    let found = false;
    const settings = await writeSettings(req.params.id, (current) => ({
      ...current,
      rules: (current.rules ?? []).map((rule) => {
        if (rule.id !== ruleId) return rule;
        found = true;
        return {
          ...rule,
          ...(title !== undefined ? { title: String(title).trim() } : {}),
          ...(description !== undefined
            ? { description: String(description).trim() }
            : {}),
        };
      }),
    }));

    if (!found) return res.status(404).json({ error: "Rule not found" });
    res.json({ success: true, rules: settings.rules });
  } catch (error) {
    console.error("Update community rule error:", error);
    res.status(500).json({ error: process.env.NODE_ENV === "production" ? undefined : error.message });
  }
});

router.delete("/:id/rules/:ruleId", protect, isCommunityAdmin, async (req, res) => {
  try {
    const { ruleId } = req.params;
    const settings = await writeSettings(req.params.id, (current) => ({
      ...current,
      rules: (current.rules ?? []).filter((rule) => rule.id !== ruleId),
    }));
    res.json({ success: true, rules: settings.rules });
  } catch (error) {
    console.error("Delete community rule error:", error);
    res.status(500).json({ error: process.env.NODE_ENV === "production" ? undefined : error.message });
  }
});

// ---------------------------------------------------------------------------
// Members & moderation
// ---------------------------------------------------------------------------

router.get("/:id/members/:userId/role", protect, checkPrivateCommunityAccess, async (req, res) => {
  try {
    const member = await prisma.communityMember.findFirst({
      where: { communityId: req.params.id, userId: req.params.userId },
      select: { role: true, status: true, joinedAt: true },
    });
    if (!member) return res.status(404).json({ error: "Member not found" });
    res.json({ success: true, ...member });
  } catch (error) {
    console.error("Get member role error:", error);
    res.status(500).json({ error: process.env.NODE_ENV === "production" ? undefined : error.message });
  }
});

const ALLOWED_ROLES = ["member", "moderator", "admin"];

router.put("/:id/members/:userId/role", protect, isCommunityAdmin, async (req, res) => {
  try {
    const { role } = req.body || {};
    if (!ALLOWED_ROLES.includes(role)) {
      return res
        .status(400)
        .json({ error: `role must be one of: ${ALLOWED_ROLES.join(", ")}` });
    }

    const { count } = await prisma.communityMember.updateMany({
      where: { communityId: req.params.id, userId: req.params.userId },
      data: { role },
    });
    if (!count) return res.status(404).json({ error: "Member not found" });

    res.json({ success: true, userId: req.params.userId, role });
  } catch (error) {
    console.error("Update member role error:", error);
    res.status(500).json({ error: process.env.NODE_ENV === "production" ? undefined : error.message });
  }
});

router.delete("/:id/members/:userId", protect, isCommunityAdminOrModerator, async (req, res) => {
  try {
    const { id: communityId, userId } = req.params;

    const { count } = await prisma.communityMember.deleteMany({
      where: { communityId, userId },
    });
    if (!count) return res.status(404).json({ error: "Member not found" });

    await prisma.community.update({
      where: { id: communityId },
      data: { memberCount: { decrement: 1 } },
    });

    res.json({ success: true, userId });
  } catch (error) {
    console.error("Remove member error:", error);
    res.status(500).json({ error: process.env.NODE_ENV === "production" ? undefined : error.message });
  }
});

/** Ban and mute are status transitions so membership history is preserved. */
const setMemberStatus = (status) => async (req, res) => {
  try {
    const { id: communityId, userId } = req.params;
    const revert = req.body?.undo === true;

    const { count } = await prisma.communityMember.updateMany({
      where: { communityId, userId },
      data: { status: revert ? "active" : status },
    });
    if (!count) return res.status(404).json({ error: "Member not found" });

    res.json({ success: true, userId, status: revert ? "active" : status });
  } catch (error) {
    console.error(`Set member ${status} error:`, error);
    res.status(500).json({ error: process.env.NODE_ENV === "production" ? undefined : error.message });
  }
};

router.post("/:id/members/:userId/ban", protect, isCommunityAdminOrModerator, setMemberStatus("banned"));
router.post("/:id/members/:userId/mute", protect, isCommunityAdminOrModerator, setMemberStatus("muted"));

// ---------------------------------------------------------------------------
// Join requests (private communities)
// ---------------------------------------------------------------------------

router.get("/:id/member-requests", protect, isCommunityAdminOrModerator, async (req, res) => {
  try {
    const requests = await prisma.communityMember.findMany({
      where: { communityId: req.params.id, status: "pending" },
      include: { user: { select: userSelect } },
      orderBy: { joinedAt: "asc" },
    });
    res.json({ success: true, requests });
  } catch (error) {
    console.error("List member requests error:", error);
    res.status(500).json({ error: process.env.NODE_ENV === "production" ? undefined : error.message });
  }
});

router.post(
  "/:id/member-requests/:userId/approve",
  protect,
  isCommunityAdminOrModerator,
  async (req, res) => {
    try {
      const { id: communityId, userId } = req.params;

      const { count } = await prisma.communityMember.updateMany({
        where: { communityId, userId, status: "pending" },
        data: { status: "active" },
      });
      if (!count) return res.status(404).json({ error: "Request not found" });

      await prisma.community.update({
        where: { id: communityId },
        data: { memberCount: { increment: 1 } },
      });

      res.json({ success: true, userId, status: "active" });
    } catch (error) {
      console.error("Approve member request error:", error);
      res.status(500).json({ error: process.env.NODE_ENV === "production" ? undefined : error.message });
    }
  },
);

router.post(
  "/:id/member-requests/:userId/deny",
  protect,
  isCommunityAdminOrModerator,
  async (req, res) => {
    try {
      const { count } = await prisma.communityMember.deleteMany({
        where: { communityId: req.params.id, userId: req.params.userId, status: "pending" },
      });
      if (!count) return res.status(404).json({ error: "Request not found" });
      res.json({ success: true, userId: req.params.userId, status: "denied" });
    } catch (error) {
      console.error("Deny member request error:", error);
      res.status(500).json({ error: process.env.NODE_ENV === "production" ? undefined : error.message });
    }
  },
);

// ---------------------------------------------------------------------------
// Invites
// ---------------------------------------------------------------------------

router.post("/:id/invite", protect, isCommunityAdminOrModerator, async (req, res) => {
  try {
    const communityId = req.params.id;
    // URL-safe and short enough to share, with 64 bits of entropy.
    const code = crypto.randomBytes(8).toString("base64url");
    const expiresInDays = Number(req.body?.expiresInDays) || 7;

    const invite = {
      code,
      communityId,
      createdBy: currentUserId(req),
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + expiresInDays * 86400000).toISOString(),
    };

    await writeSettings(communityId, (current) => ({
      ...current,
      invites: { ...(current.invites ?? {}), [code]: invite },
    }));

    res.status(201).json({ success: true, invite });
  } catch (error) {
    console.error("Create community invite error:", error);
    res.status(500).json({ error: process.env.NODE_ENV === "production" ? undefined : error.message });
  }
});

/**
 * Resolving an invite is intentionally unauthenticated so a shared link can
 * show what it points at before the recipient signs in. It exposes only public
 * community fields.
 */
router.get("/invite/:code", async (req, res) => {
  try {
    const { code } = req.params;

    // The invite code is the map key inside Community.settings.
    const communities = await prisma.community.findMany({
      where: { isActive: true },
      select: { id: true, name: true, description: true, profile: true, memberCount: true, settings: true },
    });

    const match = communities.find((c) => readSettings(c).invites?.[code]);
    if (!match) return res.status(404).json({ error: "Invite not found" });

    const invite = readSettings(match).invites[code];
    if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
      return res.status(410).json({ error: "This invite has expired" });
    }

    const { settings, ...community } = match;
    res.json({ success: true, invite: { code, expiresAt: invite.expiresAt }, community });
  } catch (error) {
    console.error("Resolve community invite error:", error);
    res.status(500).json({ error: process.env.NODE_ENV === "production" ? undefined : error.message });
  }
});

router.post("/invite/:code/accept", protect, async (req, res) => {
  try {
    const { code } = req.params;
    const userId = currentUserId(req);

    const communities = await prisma.community.findMany({
      where: { isActive: true },
      select: { id: true, settings: true },
    });

    const match = communities.find((c) => readSettings(c).invites?.[code]);
    if (!match) return res.status(404).json({ error: "Invite not found" });

    const invite = readSettings(match).invites[code];
    if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
      return res.status(410).json({ error: "This invite has expired" });
    }

    const existing = await prisma.communityMember.findFirst({
      where: { communityId: match.id, userId },
      select: { id: true, status: true },
    });
    if (existing) {
      return res.json({ success: true, communityId: match.id, alreadyMember: true });
    }

    await prisma.communityMember.create({
      data: { communityId: match.id, userId, role: "member", status: "active" },
    });
    await prisma.community.update({
      where: { id: match.id },
      data: { memberCount: { increment: 1 } },
    });

    res.json({ success: true, communityId: match.id, alreadyMember: false });
  } catch (error) {
    console.error("Accept community invite error:", error);
    res.status(500).json({ error: process.env.NODE_ENV === "production" ? undefined : error.message });
  }
});

// ---------------------------------------------------------------------------
// Announcements & per-user notification preferences
// ---------------------------------------------------------------------------

router.post("/:id/announce", protect, isCommunityAdminOrModerator, async (req, res) => {
  try {
    const communityId = req.params.id;
    const { title, message } = req.body || {};
    if (!message || !message.trim()) {
      return res.status(400).json({ error: "An announcement message is required" });
    }

    const settings = await getSettings(communityId);
    const muted = new Set(
      Object.entries(settings.notificationPrefs ?? {})
        .filter(([, prefs]) => prefs?.announcements === false)
        .map(([userId]) => userId),
    );

    const members = await prisma.communityMember.findMany({
      where: { communityId, status: "active" },
      select: { userId: true },
    });

    const community = await prisma.community.findUnique({
      where: { id: communityId },
      select: { name: true },
    });

    const { createNotification } = await import("../services/notificationService.js");
    const recipients = members
      .map((m) => m.userId)
      .filter((userId) => userId !== currentUserId(req) && !muted.has(userId));

    await Promise.all(
      recipients.map((recipientId) =>
        createNotification({
          recipientId,
          senderId: currentUserId(req),
          type: "SYSTEM",
          title: title?.trim() || `${community?.name ?? "Community"} announcement`,
          message: message.trim(),
          entityId: communityId,
          entityType: "COMMUNITY",
        }),
      ),
    );

    res.json({ success: true, notified: recipients.length });
  } catch (error) {
    console.error("Community announce error:", error);
    res.status(500).json({ error: process.env.NODE_ENV === "production" ? undefined : error.message });
  }
});

router.get("/:id/notification-settings", protect, async (req, res) => {
  try {
    const settings = await getSettings(req.params.id);
    const prefs = settings.notificationPrefs?.[currentUserId(req)] ?? {
      announcements: true,
      newPosts: true,
    };
    res.json({ success: true, settings: prefs });
  } catch (error) {
    console.error("Get community notification settings error:", error);
    res.status(500).json({ error: process.env.NODE_ENV === "production" ? undefined : error.message });
  }
});

router.put("/:id/notification-settings", protect, async (req, res) => {
  try {
    const userId = currentUserId(req);
    const incoming = req.body || {};

    const settings = await writeSettings(req.params.id, (current) => ({
      ...current,
      notificationPrefs: {
        ...(current.notificationPrefs ?? {}),
        [userId]: { ...(current.notificationPrefs?.[userId] ?? {}), ...incoming },
      },
    }));

    res.json({ success: true, settings: settings.notificationPrefs[userId] });
  } catch (error) {
    console.error("Update community notification settings error:", error);
    res.status(500).json({ error: process.env.NODE_ENV === "production" ? undefined : error.message });
  }
});

export default router;
