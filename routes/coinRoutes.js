import express from "express";
import { sendChainError } from "../chain/client.js";
import { prisma } from "../config/db.js";
import authMiddleware from "../middleware/authMiddleware.js";
import twoFactorMiddleware from "../middleware/twoFactorMiddleware.js";
import {
  getWithdrawalInfo,
  listWithdrawals,
  requestWithdrawal,
  WithdrawalError,
} from "../services/coinWithdrawalService.js";
import { COIN_PACKAGES } from "../config/giftCatalog.js";
import {
  initializeCoinPurchase,
  verifyCoinPurchase,
} from "../services/coinPurchaseService.js";

const router = express.Router();

/**
 * Sends a service error with its intended status. Errors without one are
 * unexpected, so their message is hidden in production.
 */
const sendPurchaseError = (res, error, fallback) => {
  const status = error.statusCode || 500;
  res.status(status).json({
    success: false,
    message: error.statusCode ? error.message : fallback,
    error:
      process.env.NODE_ENV === "production" || error.statusCode
        ? undefined
        : error.message,
  });
};

// ── GET /api/coins/packages ──────────────────────────────────────────────────
router.get("/packages", (req, res) => {
  res.json({ success: true, data: COIN_PACKAGES });
});

// ── GET /api/coins/balance ───────────────────────────────────────────────────
router.get("/balance", authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { coinBalance: true },
    });
    res.json({ success: true, data: { coinBalance: user.coinBalance } });
  } catch (error) {
    sendChainError(res, error, "Failed to fetch balance");
  }
});

// ── GET /api/coins/history ───────────────────────────────────────────────────
router.get("/history", authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 20, type } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = { userId: req.user.id };
    if (type) where.type = type;

    const [transactions, total] = await Promise.all([
      prisma.coinTransaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: parseInt(limit),
      }),
      prisma.coinTransaction.count({ where }),
    ]);

    res.json({
      success: true,
      data: { transactions, total, page: parseInt(page), limit: parseInt(limit) },
    });
  } catch (error) {
    sendChainError(res, error, "Failed to fetch history");
  }
});

/**
 * @swagger
 * /api/coins/purchase:
 *   post:
 *     summary: Start a coin purchase
 *     description: Creates a Whop checkout for a coin package. Whop is the only gateway; a legacy `paymentMethod` in the body is ignored. Coins are credited by the Whop webhook or by the verify call once the payment clears.
 *     tags: [Coins]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [packageId]
 *             properties:
 *               packageId:
 *                 type: string
 *               paymentMethod:
 *                 type: string
 *                 enum: [whop]
 *                 deprecated: true
 *     responses:
 *       200:
 *         description: "`data` holds `reference`, `authorizationUrl` (open in a browser) and `package`"
 *       400:
 *         description: Invalid package
 *       502:
 *         description: Whop checkout could not be created
 */
router.post("/purchase", authMiddleware, async (req, res) => {
  try {
    const data = await initializeCoinPurchase({
      userId: req.user.id,
      packageId: req.body?.packageId,
    });
    res.json({ success: true, data });
  } catch (error) {
    console.error("Coin purchase init error:", error.message);
    sendPurchaseError(res, error, "Failed to initialize purchase");
  }
});

/**
 * @swagger
 * /api/coins/purchase/verify:
 *   get:
 *     summary: Confirm a coin purchase
 *     description: Confirms the caller's purchase with Whop and credits coins once. `data.pending` true means the payment has not been confirmed yet (the webhook may still be on its way) and is not a failure.
 *     tags: [Coins]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: reference
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: "`success` true once credited; `data` holds `pending`, `coins`, `coinBalance`, `message`"
 *       404:
 *         description: No such purchase for this user
 */
// Authenticated now: the previous Paystack version was open, so a reference
// alone returned the buyer's coin balance.
router.get("/purchase/verify", authMiddleware, async (req, res) => {
  try {
    const { reference } = req.query;
    if (!reference) {
      return res.status(400).json({ success: false, message: "Reference is required" });
    }

    const result = await verifyCoinPurchase({
      reference: String(reference),
      userId: req.user.id,
    });

    // 200 even while pending: "not confirmed yet" is a normal answer.
    res.json({ success: Boolean(result.success), data: result });
  } catch (error) {
    console.error("Coin verify error:", error.message);
    sendPurchaseError(res, error, "Failed to verify payment");
  }
});


// ===== WITHDRAWALS =====
// Earned coins -> crypto, paid out manually by an admin (see coinWithdrawalService).

const sendWithdrawalError = (res, error, fallback) => {
  if (error instanceof WithdrawalError) {
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

router.get("/withdrawals/info", authMiddleware, async (req, res) => {
  try {
    res.json({ success: true, data: await getWithdrawalInfo(req.user.id) });
  } catch (error) {
    sendWithdrawalError(res, error, "Failed to load withdrawal details");
  }
});

router.get("/withdrawals", authMiddleware, async (req, res) => {
  try {
    const { page, limit } = req.query;
    res.json({ success: true, data: await listWithdrawals(req.user.id, { page, limit }) });
  } catch (error) {
    sendWithdrawalError(res, error, "Failed to load withdrawals");
  }
});

// Moving money off the platform: 2FA-protected for accounts that have it on.
router.post(
  "/withdrawals",
  authMiddleware,
  twoFactorMiddleware.requireTwoFactor(),
  async (req, res) => {
    try {
      const { coins, network, walletAddress } = req.body || {};
      const data = await requestWithdrawal({
        userId: req.user.id,
        coins,
        network,
        walletAddress,
      });
      res.status(201).json({ success: true, data });
    } catch (error) {
      sendWithdrawalError(res, error, "Failed to request withdrawal");
    }
  }
);

export default router;
