import express from "express";
import { GIFT_CATALOG } from "../config/giftCatalog.js";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  getGiftSummary,
  getReceivedGiftSummary,
  sendContentGift,
} from "../services/contentGiftService.js";
import { GiftError } from "../services/giftLedger.js";

/**
 * Coin gifts to posts (feed, reels, community posts) and user profiles.
 * Live-stream gifts stay under /api/livestream/:streamId/gift.
 */
const router = express.Router();

const sendGiftError = (res, error, fallback) => {
  if (error instanceof GiftError) {
    return res.status(error.status).json({
      success: false,
      code: error.code,
      message: error.message,
      ...error.extra,
    });
  }
  console.error(`${fallback}:`, error);
  return res.status(500).json({
    success: false,
    message: fallback,
    error: process.env.NODE_ENV === "production" ? undefined : error.message,
  });
};

/**
 * @swagger
 * /api/gifts/catalog:
 *   get:
 *     summary: Gift catalog (same gifts as live streams)
 *     tags: [Gifts]
 */
router.get("/catalog", (req, res) => {
  res.json({ success: true, data: GIFT_CATALOG });
});

/**
 * @swagger
 * /api/gifts/send:
 *   post:
 *     summary: Send a coin gift to a post or a user
 *     tags: [Gifts]
 *     security:
 *       - bearerAuth: []
 */
router.post("/send", authMiddleware, async (req, res) => {
  try {
    const { targetType, targetId, giftId, quantity, message } = req.body || {};
    const data = await sendContentGift({
      senderId: req.user.id,
      targetType,
      targetId,
      giftId,
      quantity,
      message,
    });
    res.json({
      success: true,
      message: "Gift sent",
      data: {
        gift: data.record,
        newBalance: data.newBalance,
        coinsSpent: data.coinsSpent,
        recipientId: data.recipientId,
        targetType: data.targetType,
        targetId: data.targetId,
        ...(data.giftCount !== undefined ? { giftCount: data.giftCount } : {}),
      },
    });
  } catch (error) {
    sendGiftError(res, error, "Failed to send gift");
  }
});

/**
 * @swagger
 * /api/gifts/summary:
 *   get:
 *     summary: Gift totals and top gifters for a post or a user
 *     tags: [Gifts]
 *     security:
 *       - bearerAuth: []
 */
router.get("/summary", authMiddleware, async (req, res) => {
  try {
    const { targetType, targetId } = req.query;
    const data = await getGiftSummary(targetType, targetId);
    res.json({ success: true, data });
  } catch (error) {
    sendGiftError(res, error, "Failed to load gift summary");
  }
});

/**
 * @swagger
 * /api/gifts/received/{userId}:
 *   get:
 *     summary: All gifts a user has received (posts, profile and live streams)
 *     tags: [Gifts]
 *     security:
 *       - bearerAuth: []
 */
router.get("/received/:userId", authMiddleware, async (req, res) => {
  try {
    const data = await getReceivedGiftSummary(req.params.userId);
    res.json({ success: true, data });
  } catch (error) {
    sendGiftError(res, error, "Failed to load received gifts");
  }
});

export default router;
