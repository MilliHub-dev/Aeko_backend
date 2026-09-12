import express from "express";
import { prisma } from "../config/db.js";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  buildStickerUrl,
  deleteFromCloudinary,
  stickerUpload,
} from "../services/cloudinaryService.js";
import { upgradeStickersForUser } from "../services/stickerUpgrade.js";
import { hasActiveSubscription } from "../services/subscriptionAccess.js";
import { sendError } from "../utils/apiErrors.js";

const router = express.Router();

const CREATOR_SELECT = {
  id: true,
  name: true,
  username: true,
  profilePicture: true,
  avatar: true,
};

/**
 * Multer rejections (wrong type, too large) surface as middleware errors, which
 * a route's own try/catch never sees. Without this they fell through to the
 * generic 500 handler, so "that file is not an image" read as a server fault.
 */
const receiveImage = (req, res, next) =>
  stickerUpload.single("image")(req, res, (error) => {
    if (!error) return next();
    const message =
      error.code === "LIMIT_FILE_SIZE"
        ? "Choose an image smaller than 10MB."
        : error.message || "That image could not be uploaded.";
    res.status(400).json({ success: false, code: "UPLOAD_REJECTED", message });
  });

/**
 * @swagger
 * /api/stickers:
 *   get:
 *     tags: [Stickers]
 *     summary: The shared sticker library
 *     description: Every user's stickers, newest first. Hidden stickers (moderated in the admin panel) are excluded. Pass `mine=true` for only your own.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: mine
 *         schema: { type: boolean }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 100, maximum: 200 }
 *     responses:
 *       200:
 *         description: Stickers
 */
router.get("/", authMiddleware, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 200);
    const mineOnly = req.query.mine === "true";

    // Safety net for subscriptions activated by a path that cannot call the
    // upgrade itself — a status edited directly in the admin panel or the
    // database. Awaited so the response already carries the upgraded URLs;
    // it is a no-op (one indexed query) for free users and for subscribers
    // whose stickers are already cut out.
    await upgradeStickersForUser(req.user.id);

    const stickers = await prisma.sticker.findMany({
      where: {
        isHidden: false,
        ...(mineOnly ? { creatorId: req.user.id } : {}),
      },
      include: { creator: { select: CREATOR_SELECT } },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    res.json({ success: true, stickers });
  } catch (error) {
    sendError(res, error, "stickers.list");
  }
});

/**
 * @swagger
 * /api/stickers:
 *   post:
 *     tags: [Stickers]
 *     summary: Turn an image into a sticker
 *     description: |
 *       Uploads an image and stores it as a sticker in the shared library. The
 *       delivered sticker has its background removed and is padded square as a
 *       transparent PNG.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [image]
 *             properties:
 *               image: { type: string, format: binary }
 *               name: { type: string, description: Optional label, up to 40 characters }
 *     responses:
 *       201:
 *         description: The created sticker
 *       400:
 *         description: No image, wrong type, or too large
 */
router.post("/", authMiddleware, receiveImage, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        code: "IMAGE_REQUIRED",
        message: "Choose an image to turn into a sticker.",
      });
    }

    // multer-storage-cloudinary reports the Cloudinary public_id as `filename`.
    const publicId = req.file.filename;
    const name =
      typeof req.body.name === "string" ? req.body.name.trim().slice(0, 40) : "";

    // Cutting out the background is a paid add-on, so it is offered only to
    // subscribers. Everyone else still gets a sticker — a square crop of the
    // photo — rather than being blocked from the feature.
    const backgroundRemoved = await hasActiveSubscription(req.user.id);

    const sticker = await prisma.sticker.create({
      data: {
        creatorId: req.user.id,
        publicId,
        url: buildStickerUrl(publicId, {
          withBackgroundRemoval: backgroundRemoved,
        }),
        backgroundRemoved,
        name: name || null,
      },
      include: { creator: { select: CREATOR_SELECT } },
    });

    res.status(201).json({ success: true, sticker });
  } catch (error) {
    sendError(res, error, "stickers.create");
  }
});

/**
 * @swagger
 * /api/stickers/{id}:
 *   delete:
 *     tags: [Stickers]
 *     summary: Delete a sticker you created (admins may delete any)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Deleted
 *       403:
 *         description: Not yours
 *       404:
 *         description: No such sticker
 */
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const sticker = await prisma.sticker.findUnique({
      where: { id: req.params.id },
    });

    if (!sticker) {
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "That sticker no longer exists.",
      });
    }

    if (sticker.creatorId !== req.user.id && !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        code: "NOT_YOURS",
        message: "You can only delete stickers you created.",
      });
    }

    await prisma.sticker.delete({ where: { id: sticker.id } });

    // Best effort: the row is already gone, and a leftover Cloudinary asset
    // costs storage but breaks nothing. Messages already sent keep rendering.
    deleteFromCloudinary(sticker.publicId).catch((error) =>
      console.error("sticker asset delete failed:", error),
    );

    res.json({ success: true });
  } catch (error) {
    sendError(res, error, "stickers.delete");
  }
});

export default router;
