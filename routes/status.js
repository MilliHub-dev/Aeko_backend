import express from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { prisma } from "../config/db.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { generalUpload } from "../middleware/upload.js";
import { processMentions } from "../services/notificationService.js";
import { validateStickers } from "../utils/linkSticker.js";
import statusService, {
  AUDIENCE,
  MAX_CAPTION_LENGTH,
  MAX_ITEM_DURATION_MS,
  MAX_TEXT_LENGTH,
  STORY_TTL_MS,
} from "../services/statusService.js";

const router = express.Router();

/**
 * Story/Status routes. Domain logic lives in services/statusService.js; these
 * handlers validate input, delegate, and shape the response.
 */

// Story creation is cheap to spam and expensive to store. Limit per account, not per
// IP, so users behind a shared NAT are not punished for each other.
const createStatusLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60,
  // Authenticated requests key on the account. The IP fallback goes through
  // ipKeyGenerator so IPv6 addresses are normalised to a subnet rather than a
  // single address (express-rate-limit rejects a bare req.ip here).
  keyGenerator: (req) => req.userId || ipKeyGenerator(req.ip),
  message: {
    success: false,
    message: "You have posted a lot of stories recently. Try again shortly.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const parsePagination = (req, defaultLimit = 20, maxLimit = 50) => ({
  page: Math.max(1, Number.parseInt(req.query.page, 10) || 1),
  limit: Math.min(maxLimit, Math.max(1, Number.parseInt(req.query.limit, 10) || defaultLimit)),
});

/** Accepts a JSON array or a JSON-encoded string (multipart sends strings). */
const parseMaybeJsonArray = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

/**
 * @swagger
 * /api/status:
 *   post:
 *     summary: Create a story (text, image or video)
 *     tags: [Status]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Created }
 *       400: { description: Validation error }
 */
router.post(
  "/",
  authMiddleware,
  createStatusLimit,
  (req, res, next) => {
    const upload = generalUpload.fields([
      { name: "file", maxCount: 1 },
      { name: "media", maxCount: 1 },
      { name: "image", maxCount: 1 },
      { name: "video", maxCount: 1 },
    ]);

    upload(req, res, (err) => {
      if (!err) return next();
      console.error("Status upload error:", err);
      if (err.name === "MulterError") {
        return res.status(400).json({ success: false, error: `Upload error: ${err.message}` });
      }
      return res.status(500).json({ success: false, error: "File upload failed" });
    });
  },
  async (req, res) => {
    try {
      const userId = req.userId;
      let { type, content } = req.body;
      const { caption, description, backgroundColor, font, audience } = req.body;

      const uploaded =
        req.files &&
        (req.files.file?.[0] ||
          req.files.media?.[0] ||
          req.files.image?.[0] ||
          req.files.video?.[0]);

      let cloudinaryPublicId = null;
      let cloudinaryResourceType = null;

      if (uploaded) {
        // multer-storage-cloudinary puts the secure URL on .path and the public id
        // on .filename. Both are needed: the URL to serve, the id to delete.
        content = uploaded.path;
        cloudinaryPublicId = uploaded.filename || null;

        if (uploaded.mimetype?.startsWith("image/")) {
          type = type || "image";
          cloudinaryResourceType = "image";
        } else if (uploaded.mimetype?.startsWith("video/")) {
          type = type || "video";
          cloudinaryResourceType = "video";
        }
      } else if (!type && content) {
        type = "text";
      }

      if (!statusService.STATUS_TYPES.includes(type)) {
        return res.status(400).json({
          success: false,
          error: `type must be one of: ${statusService.STATUS_TYPES.join(", ")}`,
        });
      }

      if (!content) {
        return res.status(400).json({
          success: false,
          error: type === "text" ? "content is required" : "a media file is required",
        });
      }

      // A media story must arrive as an upload. Rejecting a client-supplied URI here
      // is what stops device-local file:// paths being persisted as story content.
      if ((type === "image" || type === "video") && !uploaded) {
        return res.status(400).json({
          success: false,
          error:
            "Media stories must be uploaded as multipart/form-data. Send the file under the 'media' field.",
        });
      }

      if (type === "text" && content.length > MAX_TEXT_LENGTH) {
        return res.status(400).json({
          success: false,
          error: `Text stories are limited to ${MAX_TEXT_LENGTH} characters.`,
        });
      }

      const statusCaption = caption || description || null;
      if (statusCaption && statusCaption.length > MAX_CAPTION_LENGTH) {
        return res.status(400).json({
          success: false,
          error: `Captions are limited to ${MAX_CAPTION_LENGTH} characters.`,
        });
      }

      const requestedAudience = (audience || AUDIENCE.FOLLOWERS).toUpperCase();
      if (!Object.values(AUDIENCE).includes(requestedAudience)) {
        return res.status(400).json({
          success: false,
          error: `audience must be one of: ${Object.values(AUDIENCE).join(", ")}`,
        });
      }

      let durationMs = Number.parseInt(req.body.durationMs, 10);
      if (!Number.isFinite(durationMs) || durationMs <= 0) durationMs = null;
      if (durationMs && durationMs > MAX_ITEM_DURATION_MS) {
        return res.status(400).json({
          success: false,
          error: `Video stories are limited to ${MAX_ITEM_DURATION_MS / 1000} seconds.`,
        });
      }

      // Link stickers are validated server-side: scheme, credentials, private hosts
      // and trust classification are all resolved here so a crafted client cannot
      // store a destination the viewer would be sent to without a warning.
      const stickerResult = validateStickers(parseMaybeJsonArray(req.body.stickers));
      if (!stickerResult.ok) {
        return res.status(400).json({ success: false, error: stickerResult.error });
      }

      const toInt = (v) => {
        const n = Number.parseInt(v, 10);
        return Number.isFinite(n) && n > 0 ? n : null;
      };

      const created = await prisma.status.create({
        data: {
          userId,
          type,
          content,
          caption: statusCaption,
          backgroundColor: backgroundColor || null,
          font: font || null,
          audience: requestedAudience,
          hiddenFromUserIds: parseMaybeJsonArray(req.body.hiddenFromUserIds),
          mentions: parseMaybeJsonArray(req.body.mentions),
          stickers: stickerResult.stickers,
          durationMs,
          thumbnailUrl: req.body.thumbnailUrl || null,
          mediaWidth: toInt(req.body.mediaWidth),
          mediaHeight: toInt(req.body.mediaHeight),
          cloudinaryPublicId,
          cloudinaryResourceType,
          expiresAt: new Date(Date.now() + STORY_TTL_MS),
          reactions: [],
        },
        include: { users: { select: { id: true, username: true, name: true, profilePicture: true, avatar: true, blueTick: true, goldenTick: true, prideTick: true, businessTick: true } } },
      });

      // @mentions in the text or caption notify and deep-link, reusing the same
      // helper posts and comments use.
      const mentionSource = [type === "text" ? content : null, statusCaption]
        .filter(Boolean)
        .join(" ");
      if (mentionSource) {
        void processMentions({
          text: mentionSource,
          senderId: userId,
          entityId: created.id,
          entityType: "STATUS",
        });
      }

      res.status(201).json({
        success: true,
        status: statusService.serializeStatus(created, userId),
      });
    } catch (error) {
      console.error("Create status error:", error);
      res.status(500).json({ success: false, error: "Failed to create story" });
    }
  },
);

/**
 * @swagger
 * /api/status:
 *   get:
 *     summary: Story feed, grouped by author. Followers-only unless a story opts into a wider audience.
 *     tags: [Status]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20 } }
 *     responses:
 *       200: { description: Grouped feed }
 */
router.get("/", authMiddleware, async (req, res) => {
  try {
    const { page, limit } = parsePagination(req);
    const feed = await statusService.getFeed(req.userId, { page, limit });
    res.json({ success: true, ...feed });
  } catch (error) {
    console.error("Story feed error:", error);
    res.status(500).json({ success: false, error: "Failed to load stories" });
  }
});

/**
 * @swagger
 * /api/status/me:
 *   get:
 *     summary: The caller's own stories with engagement counts
 *     tags: [Status]
 *     security: [{ bearerAuth: [] }]
 */
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const includeExpired = req.query.includeExpired === "true";
    const statuses = await statusService.getOwnStories(req.userId, { includeExpired });
    res.json({ success: true, statuses });
  } catch (error) {
    console.error("Own stories error:", error);
    res.status(500).json({ success: false, error: "Failed to load your stories" });
  }
});

/**
 * @swagger
 * /api/status/views:
 *   post:
 *     summary: Record views for one or more stories. Idempotent.
 *     tags: [Status]
 *     security: [{ bearerAuth: [] }]
 */
router.post("/views", authMiddleware, async (req, res) => {
  try {
    const statusIds = Array.isArray(req.body.statusIds)
      ? req.body.statusIds
      : [req.body.statusId].filter(Boolean);

    if (statusIds.length === 0) {
      return res.status(400).json({ success: false, error: "statusIds is required" });
    }

    const result = await statusService.markViewed(req.userId, statusIds);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error("Record views error:", error);
    res.status(500).json({ success: false, error: "Failed to record views" });
  }
});

/**
 * @swagger
 * /api/status/mute/{userId}:
 *   post:
 *     summary: Hide a user's stories without blocking them
 *     tags: [Status]
 *     security: [{ bearerAuth: [] }]
 */
router.post("/mute/:userId", authMiddleware, async (req, res) => {
  try {
    if (req.params.userId === req.userId) {
      return res.status(400).json({ success: false, error: "You cannot mute yourself" });
    }
    const result = await statusService.setMuted(req.userId, req.params.userId, true);
    if (result.error) return res.status(404).json({ success: false, error: "User not found" });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error("Mute stories error:", error);
    res.status(500).json({ success: false, error: "Failed to mute stories" });
  }
});

router.delete("/mute/:userId", authMiddleware, async (req, res) => {
  try {
    const result = await statusService.setMuted(req.userId, req.params.userId, false);
    if (result.error) return res.status(404).json({ success: false, error: "User not found" });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error("Unmute stories error:", error);
    res.status(500).json({ success: false, error: "Failed to unmute stories" });
  }
});

/* ----------------------------------------------------------- close friends */

/**
 * @swagger
 * /api/status/close-friends:
 *   get:
 *     summary: Your close-friends list
 *     tags: [Status]
 *     security: [{ bearerAuth: [] }]
 */
router.get("/close-friends", authMiddleware, async (req, res) => {
  try {
    const result = await statusService.getCloseFriends(req.userId);
    if (result.error) return res.status(404).json({ success: false, error: "User not found" });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error("Get close friends error:", error);
    res.status(500).json({ success: false, error: "Failed to load close friends" });
  }
});

/** Replace the whole list. Used by the management screen's save action. */
router.put("/close-friends", authMiddleware, async (req, res) => {
  try {
    if (!Array.isArray(req.body.userIds)) {
      return res.status(400).json({ success: false, error: "userIds must be an array" });
    }
    const result = await statusService.setCloseFriends(req.userId, req.body.userIds);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error("Set close friends error:", error);
    res.status(500).json({ success: false, error: "Failed to update close friends" });
  }
});

router.post("/close-friends/:userId", authMiddleware, async (req, res) => {
  try {
    const result = await statusService.updateCloseFriend(req.userId, req.params.userId, true);
    if (result.error === "SELF") {
      return res.status(400).json({ success: false, error: "You cannot add yourself" });
    }
    if (result.error) return res.status(404).json({ success: false, error: "User not found" });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error("Add close friend error:", error);
    res.status(500).json({ success: false, error: "Failed to add close friend" });
  }
});

router.delete("/close-friends/:userId", authMiddleware, async (req, res) => {
  try {
    const result = await statusService.updateCloseFriend(req.userId, req.params.userId, false);
    if (result.error) return res.status(404).json({ success: false, error: "User not found" });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error("Remove close friend error:", error);
    res.status(500).json({ success: false, error: "Failed to remove close friend" });
  }
});

/* --------------------------------------------------------------- highlights */

/**
 * @swagger
 * /api/status/highlights:
 *   get:
 *     summary: Story highlights. Own by default, or another user's via ?userId
 *     tags: [Status]
 *     security: [{ bearerAuth: [] }]
 */
router.get("/highlights", authMiddleware, async (req, res) => {
  try {
    const ownerId = req.query.userId || req.userId;
    const result = await statusService.getHighlights(ownerId, req.userId);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error("Get highlights error:", error);
    res.status(500).json({ success: false, error: "Failed to load highlights" });
  }
});

router.post("/highlights", authMiddleware, async (req, res) => {
  try {
    const title = typeof req.body.title === "string" ? req.body.title.trim() : "";
    if (!title) {
      return res.status(400).json({ success: false, error: "A title is required" });
    }
    if (title.length > 60) {
      return res.status(400).json({ success: false, error: "Title is too long" });
    }

    const result = await statusService.createHighlight(req.userId, {
      title,
      coverUrl: req.body.coverUrl ?? null,
      statusIds: req.body.statusIds ?? [],
    });
    res.status(201).json({ success: true, ...result });
  } catch (error) {
    console.error("Create highlight error:", error);
    res.status(500).json({ success: false, error: "Failed to create highlight" });
  }
});

router.patch("/highlights/:highlightId", authMiddleware, async (req, res) => {
  try {
    const result = await statusService.updateHighlight(req.userId, req.params.highlightId, req.body);
    if (result.error) return res.status(404).json({ success: false, error: "Highlight not found" });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error("Update highlight error:", error);
    res.status(500).json({ success: false, error: "Failed to update highlight" });
  }
});

router.delete("/highlights/:highlightId", authMiddleware, async (req, res) => {
  try {
    const result = await statusService.deleteHighlight(req.userId, req.params.highlightId);
    if (result.error) return res.status(404).json({ success: false, error: "Highlight not found" });
    res.json({ success: true, message: "Highlight deleted" });
  } catch (error) {
    console.error("Delete highlight error:", error);
    res.status(500).json({ success: false, error: "Failed to delete highlight" });
  }
});

/** Pin stories to a highlight so they outlive the 24h window. */
router.post("/highlights/:highlightId/items", authMiddleware, async (req, res) => {
  try {
    const statusIds = Array.isArray(req.body.statusIds)
      ? req.body.statusIds
      : [req.body.statusId].filter(Boolean);

    if (statusIds.length === 0) {
      return res.status(400).json({ success: false, error: "statusIds is required" });
    }

    const result = await statusService.addHighlightItems(req.userId, req.params.highlightId, statusIds);
    if (result.error) return res.status(404).json({ success: false, error: "Highlight not found" });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error("Add highlight items error:", error);
    res.status(500).json({ success: false, error: "Failed to add to highlight" });
  }
});

router.delete("/highlights/:highlightId/items/:itemId", authMiddleware, async (req, res) => {
  try {
    const result = await statusService.removeHighlightItem(
      req.userId,
      req.params.highlightId,
      req.params.itemId,
    );
    if (result.error) return res.status(404).json({ success: false, error: "Item not found" });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error("Remove highlight item error:", error);
    res.status(500).json({ success: false, error: "Failed to remove from highlight" });
  }
});

/**
 * @swagger
 * /api/status/{id}:
 *   get:
 *     summary: A single story, audience-checked
 *     tags: [Status]
 *     security: [{ bearerAuth: [] }]
 */
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const status = await statusService.getStatusForViewer(req.params.id, req.userId);
    if (!status) {
      return res.status(404).json({ success: false, error: "Story not found" });
    }
    res.json({ success: true, status });
  } catch (error) {
    console.error("Get status error:", error);
    res.status(500).json({ success: false, error: "Failed to load story" });
  }
});

/**
 * @swagger
 * /api/status/{id}/link-click:
 *   post:
 *     summary: Record that a viewer opened a story's link sticker
 *     tags: [Status]
 *     security: [{ bearerAuth: [] }]
 */
router.post("/:id/link-click", authMiddleware, async (req, res) => {
  try {
    // Audience gate: you cannot register a click on a story you cannot see.
    const visible = await statusService.getStatusForViewer(req.params.id, req.userId);
    if (!visible) return res.status(404).json({ success: false, error: "Story not found" });

    const sticker = Array.isArray(visible.stickers)
      ? visible.stickers.find((s) => s?.type === "link")
      : null;
    if (!sticker) {
      return res.status(400).json({ success: false, error: "This story has no link" });
    }

    const result = await statusService.recordLinkClick(
      req.params.id,
      req.userId,
      sticker.url,
    );

    res.json({ success: true, ...result });
  } catch (error) {
    console.error("Record link click error:", error);
    res.status(500).json({ success: false, error: "Failed to record click" });
  }
});

/**
 * @swagger
 * /api/status/{id}/viewers:
 *   get:
 *     summary: Who viewed this story. Author only.
 *     tags: [Status]
 *     security: [{ bearerAuth: [] }]
 */
router.get("/:id/viewers", authMiddleware, async (req, res) => {
  try {
    const { page, limit } = parsePagination(req, 30, 100);
    const result = await statusService.getViewers(req.params.id, req.userId, { page, limit });

    if (result.error === "NOT_FOUND") {
      return res.status(404).json({ success: false, error: "Story not found" });
    }
    if (result.error === "FORBIDDEN") {
      return res.status(403).json({ success: false, error: "Only the author can see viewers" });
    }

    res.json({ success: true, ...result });
  } catch (error) {
    console.error("Get viewers error:", error);
    res.status(500).json({ success: false, error: "Failed to load viewers" });
  }
});

/**
 * @swagger
 * /api/status/{id}/react:
 *   post:
 *     summary: Set your reaction to a story (replaces any previous one)
 *     tags: [Status]
 *     security: [{ bearerAuth: [] }]
 */
router.post("/:id/react", authMiddleware, async (req, res) => {
  try {
    const { emoji } = req.body;
    if (!emoji || typeof emoji !== "string" || emoji.length > 16) {
      return res.status(400).json({ success: false, error: "A valid emoji is required" });
    }

    // Audience gate: you may only react to a story you can actually see.
    const visible = await statusService.getStatusForViewer(req.params.id, req.userId);
    if (!visible) return res.status(404).json({ success: false, error: "Story not found" });

    const result = await statusService.setReaction(req.params.id, req.userId, emoji);
    if (result.error === "NOT_FOUND") {
      return res.status(404).json({ success: false, error: "Story not found" });
    }
    if (result.error === "EXPIRED") {
      return res.status(410).json({ success: false, error: "This story has expired" });
    }

    res.json({ success: true, reaction: result.reaction });
  } catch (error) {
    console.error("React to status error:", error);
    res.status(500).json({ success: false, error: "Failed to react" });
  }
});

router.delete("/:id/react", authMiddleware, async (req, res) => {
  try {
    await statusService.removeReaction(req.params.id, req.userId);
    res.json({ success: true });
  } catch (error) {
    console.error("Remove reaction error:", error);
    res.status(500).json({ success: false, error: "Failed to remove reaction" });
  }
});

/**
 * @swagger
 * /api/status/{id}/reply:
 *   post:
 *     summary: Reply to a story. Delivered as a direct message quoting the story.
 *     tags: [Status]
 *     security: [{ bearerAuth: [] }]
 */
router.post("/:id/reply", authMiddleware, async (req, res) => {
  try {
    const text = typeof req.body.text === "string" ? req.body.text.trim() : "";
    if (!text) {
      return res.status(400).json({ success: false, error: "A reply message is required" });
    }
    if (text.length > 2000) {
      return res.status(400).json({ success: false, error: "Reply is too long" });
    }

    const visible = await statusService.getStatusForViewer(req.params.id, req.userId);
    if (!visible) return res.status(404).json({ success: false, error: "Story not found" });

    const result = await statusService.replyToStatus(req.params.id, req.userId, text);

    if (result.error === "NOT_FOUND") {
      return res.status(404).json({ success: false, error: "Story not found" });
    }
    if (result.error === "SELF_REPLY") {
      return res.status(400).json({ success: false, error: "You cannot reply to your own story" });
    }
    if (result.error === "EXPIRED") {
      return res.status(410).json({ success: false, error: "This story has expired" });
    }

    // Deliver live into the existing chat thread. Sockets join a room named by user
    // id and listen for "new_message" — see sockets/enhancedChatSocket.js.
    const io = req.app.get("io");
    if (io) {
      io.to(result.message.receiverId).emit("new_message", {
        message: result.message,
        chatId: result.chat.id,
        sender: result.message.sender,
      });
    }

    res.status(201).json({ success: true, message: result.message, chatId: result.chat.id });
  } catch (error) {
    console.error("Reply to status error:", error);
    res.status(500).json({ success: false, error: "Failed to send reply" });
  }
});

/**
 * @swagger
 * /api/status/{id}:
 *   delete:
 *     summary: Delete your story and its media
 *     tags: [Status]
 *     security: [{ bearerAuth: [] }]
 */
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const result = await statusService.deleteStatus(req.params.id, req.userId);
    if (result.error === "NOT_FOUND") {
      return res.status(404).json({ success: false, error: "Story not found or not yours" });
    }
    res.json({ success: true, message: "Story deleted", mediaRetained: result.mediaRetained });
  } catch (error) {
    console.error("Delete status error:", error);
    res.status(500).json({ success: false, error: "Failed to delete story" });
  }
});

/**
 * @swagger
 * /api/status/{id}/reshare:
 *   post:
 *     summary: Reshare someone's story to your own
 *     tags: [Status]
 *     security: [{ bearerAuth: [] }]
 */
router.post("/:id/reshare", authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const { caption, backgroundColor, font } = req.body;

    const original = await prisma.status.findUnique({
      where: { id: req.params.id },
      include: {
        users: {
          select: {
            id: true, username: true, name: true, profilePicture: true,
            avatar: true, blueTick: true, goldenTick: true, prideTick: true, businessTick: true,
          },
        },
      },
    });

    if (!original) return res.status(404).json({ success: false, error: "Story not found" });
    if (original.expiresAt <= new Date()) {
      return res.status(410).json({ success: false, error: "Cannot reshare an expired story" });
    }

    // Reuse the audience gate rather than re-deriving visibility here.
    const visible = await statusService.getStatusForViewer(req.params.id, userId);
    if (!visible) {
      return res.status(403).json({ success: false, error: "You cannot reshare this story" });
    }

    const isText = original.type === "text";
    const created = await prisma.status.create({
      data: {
        userId,
        type: "shared_post",
        content: caption || "",
        backgroundColor: backgroundColor || original.backgroundColor,
        font: font || original.font,
        // A reshare is never wider than the viewer's own default.
        audience: AUDIENCE.FOLLOWERS,
        expiresAt: new Date(Date.now() + STORY_TTL_MS),
        reactions: [],
        originalContent: {
          creator: original.users,
          text: isText ? original.content : original.caption,
          media: isText ? null : original.content,
          type: original.type,
          thumbnailUrl: original.thumbnailUrl,
          createdAt: original.createdAt,
          originalId: original.id,
        },
        shareMetadata: {
          sharedBy: userId,
          sharedAt: new Date(),
          originalStatusId: original.id,
        },
      },
      include: { users: { select: { id: true, username: true, name: true, profilePicture: true, avatar: true, blueTick: true, goldenTick: true, prideTick: true, businessTick: true } } },
    });

    res.status(201).json({
      success: true,
      status: statusService.serializeStatus(created, userId),
    });
  } catch (error) {
    console.error("Reshare status error:", error);
    res.status(500).json({ success: false, error: "Failed to reshare story" });
  }
});

export default router;
