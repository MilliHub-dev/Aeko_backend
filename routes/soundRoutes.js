import express from "express";
import multer from "multer";
import os from "os";
import path from "path";
import { promises as fs } from "fs";
import authMiddleware from "../middleware/authMiddleware.js";
import { prisma } from "../config/db.js";
import { attachRepostData } from "../services/repostService.js";
import {
  MAX_SOUND_BYTES,
  SOUND_CATEGORIES,
  SoundError,
  createSoundFromFile,
  deactivateSound,
  extractSoundFromPost,
  getSound,
  listSounds,
  reportSound,
  toPublicSound,
} from "../services/soundService.js";

const router = express.Router();

const AUDIO_MIME = /^audio\/|^video\/(mp4|quicktime|webm)$/; // m4a arrives as video/mp4 from iOS
const audioUpload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (_req, file, cb) =>
      cb(null, `aeko-sound-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname || "").slice(0, 8)}`),
  }),
  limits: { fileSize: MAX_SOUND_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (AUDIO_MIME.test(file.mimetype || "")) return cb(null, true);
    cb(new Error("Upload an audio file (mp3, m4a, wav, ogg)."));
  },
});

const sendError = (res, error, fallback) => {
  if (error instanceof SoundError) {
    return res.status(error.status).json({ success: false, message: error.message, code: error.code });
  }
  console.error(fallback, error);
  return res.status(500).json({ success: false, message: fallback });
};

const isAdmin = (req) => Boolean(req.user?.isAdmin);

/**
 * @swagger
 * /api/sounds:
 *   get:
 *     tags: [Sounds]
 *     summary: Browse or search sounds
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *       - in: query
 *         name: sort
 *         schema: { type: string, enum: [trending, recent] }
 *       - in: query
 *         name: source
 *         schema: { type: string, enum: [LIBRARY, USER_UPLOAD, EXTRACTED] }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, maximum: 50 }
 */
router.get("/", authMiddleware, async (req, res) => {
  try {
    const result = await listSounds({
      q: req.query.q,
      category: req.query.category,
      sort: req.query.sort,
      source: req.query.source,
      page: req.query.page,
      limit: req.query.limit,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    sendError(res, error, "Failed to load sounds");
  }
});

router.get("/categories", authMiddleware, (_req, res) => {
  res.json({ success: true, categories: SOUND_CATEGORIES });
});

/** Sounds the caller added (uploads and original sounds). */
router.get("/mine", authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    const result = await listSounds({ uploaderId: userId, sort: "recent", page: req.query.page, limit: req.query.limit });
    res.json({ success: true, ...result });
  } catch (error) {
    sendError(res, error, "Failed to load your sounds");
  }
});

/**
 * @swagger
 * /api/sounds:
 *   post:
 *     tags: [Sounds]
 *     summary: Upload an audio file as a reusable sound
 *     description: Multipart with `audio` plus `title`, `artist`, `category`. Admins may set `source=LIBRARY` for CC0 tracks.
 *     security:
 *       - bearerAuth: []
 */
router.post(
  "/",
  authMiddleware,
  (req, res, next) => {
    audioUpload.single("audio")(req, res, (err) => {
      if (!err) return next();
      const status = err.name === "MulterError" || /audio file/.test(err.message) ? 400 : 500;
      res.status(status).json({ success: false, message: err.message || "Upload failed" });
    });
  },
  async (req, res) => {
    const filePath = req.file?.path;
    try {
      if (!filePath) return res.status(400).json({ success: false, message: "Send the audio file under the 'audio' field." });
      const userId = req.user?.id || req.userId;
      const wantsLibrary = req.body.source === "LIBRARY";
      if (wantsLibrary && !isAdmin(req)) {
        return res.status(403).json({ success: false, message: "Only admins can add library tracks." });
      }
      const sound = await createSoundFromFile({
        filePath,
        title: req.body.title || path.parse(req.file.originalname || "").name,
        artist: req.body.artist,
        category: req.body.category,
        coverUrl: wantsLibrary ? req.body.coverUrl : undefined,
        uploaderId: userId,
        source: wantsLibrary ? "LIBRARY" : "USER_UPLOAD",
        license: wantsLibrary ? req.body.license || "CC0" : "ORIGINAL",
      });
      res.status(201).json({ success: true, sound: toPublicSound(sound) });
    } catch (error) {
      sendError(res, error, "Failed to add the sound");
    } finally {
      if (filePath) await fs.unlink(filePath).catch(() => {});
    }
  },
);

/**
 * @swagger
 * /api/sounds/extract:
 *   post:
 *     tags: [Sounds]
 *     summary: Make the audio of one of your video posts a reusable sound
 *     security:
 *       - bearerAuth: []
 */
router.post("/extract", authMiddleware, async (req, res) => {
  try {
    const { postId, title } = req.body || {};
    if (!postId) return res.status(400).json({ success: false, message: "postId is required" });
    const { sound, created } = await extractSoundFromPost({
      postId,
      userId: req.user?.id || req.userId,
      title,
      isAdmin: isAdmin(req),
    });
    res.status(created ? 201 : 200).json({ success: true, created, sound: toPublicSound(sound) });
  } catch (error) {
    sendError(res, error, "Could not extract the sound");
  }
});

router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const sound = await getSound(req.params.id, { includeInactive: isAdmin(req) });
    if (!sound) return res.status(404).json({ success: false, message: "Sound not found" });
    res.json({ success: true, sound: toPublicSound(sound) });
  } catch (error) {
    sendError(res, error, "Failed to load the sound");
  }
});

/** Public posts using this sound, newest first ("Use this sound" page). */
router.get("/:id/posts", authMiddleware, async (req, res) => {
  try {
    const sound = await getSound(req.params.id);
    if (!sound) return res.status(404).json({ success: false, message: "Sound not found" });
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);

    const rows = await prisma.post.findMany({
      where: { soundId: sound.id, status: "active", OR: [{ privacy: { equals: null } }, { privacy: { path: ["level"], equals: "public" } }] },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit + 1,
      select: {
        id: true, userId: true, text: true, type: true, media: true, views: true, likes: true, engagement: true,
        createdAt: true, originalPostId: true, soundId: true, soundStartMs: true,
        _count: { select: { comments: true } },
        users_posts_userIdTouser: {
          select: { id: true, username: true, name: true, profilePicture: true, blueTick: true, goldenTick: true, prideTick: true, businessTick: true },
        },
      },
    });
    const viewerId = req.user?.id || req.userId;
    const posts = rows.slice(0, limit).map(({ users_posts_userIdTouser: user, _count, likes, ...p }) => ({
      ...p,
      _id: p.id,
      user,
      likesCount: Array.isArray(likes) ? likes.length : 0,
      isLiked: Array.isArray(likes) && likes.includes(viewerId),
      commentsCount: _count?.comments ?? 0,
    }));
    res.json({
      success: true,
      sound: toPublicSound(sound),
      posts: await attachRepostData(posts, viewerId),
      page,
      limit,
      hasMore: rows.length > limit,
    });
  } catch (error) {
    sendError(res, error, "Failed to load posts for this sound");
  }
});

router.post("/:id/report", authMiddleware, async (req, res) => {
  try {
    const report = await reportSound({ soundId: req.params.id, reporterId: req.user?.id || req.userId, reason: req.body?.reason });
    res.status(201).json({ success: true, report });
  } catch (error) {
    sendError(res, error, "Failed to report the sound");
  }
});

router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const result = await deactivateSound({ soundId: req.params.id, userId: req.user?.id || req.userId, isAdmin: isAdmin(req) });
    res.json({ success: true, ...result });
  } catch (error) {
    sendError(res, error, "Failed to remove the sound");
  }
});

export default router;
