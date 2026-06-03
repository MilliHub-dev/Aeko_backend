import express from "express";
import axios from "axios";
import Stripe from "stripe";
import { v4 as uuidV4 } from "uuid";
import { prisma } from "../config/db.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { COIN_PACKAGES, getCoinPackageById } from "../config/giftCatalog.js";

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const paystack = axios.create({
  baseURL: "https://api.paystack.co",
  headers: {
    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
    "Content-Type": "application/json",
  },
});

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
    res.status(500).json({ success: false, message: "Failed to fetch balance" });
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
    res.status(500).json({ success: false, message: "Failed to fetch history" });
  }
});

// ── POST /api/coins/purchase ─────────────────────────────────────────────────
// Initialize a coin purchase via Paystack or Stripe
router.post("/purchase", authMiddleware, async (req, res) => {
  try {
    const { packageId, paymentMethod = "paystack" } = req.body;

    const pkg = getCoinPackageById(packageId);
    if (!pkg) return res.status(400).json({ success: false, message: "Invalid package" });

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const reference = `COINS_${uuidV4()}`;

    if (paymentMethod === "paystack") {
      const response = await paystack.post("/transaction/initialize", {
        email: user.email,
        amount: pkg.pricePaise * 100, // Paystack uses kobo (100 kobo = 1 NGN) — adjust per currency
        currency: "NGN",
        reference,
        metadata: {
          userId: req.user.id,
          packageId: pkg.id,
          coins: pkg.coins,
          type: "coin_purchase",
        },
      });

      return res.json({
        success: true,
        data: {
          reference,
          authorizationUrl: response.data.data.authorization_url,
          accessCode: response.data.data.access_code,
          package: pkg,
        },
      });
    }

    if (paymentMethod === "stripe") {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: { name: pkg.label, description: `${pkg.coins} Aeko Coins` },
              unit_amount: Math.round(pkg.priceUSD * 100),
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${process.env.FRONTEND_URL}/coins/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL}/coins/cancel`,
        metadata: { userId: req.user.id, packageId: pkg.id, coins: String(pkg.coins), reference },
      });

      return res.json({
        success: true,
        data: { reference, sessionId: session.id, url: session.url, package: pkg },
      });
    }

    res.status(400).json({ success: false, message: "Unsupported payment method. Use paystack or stripe" });
  } catch (error) {
    console.error("Coin purchase init error:", error);
    res.status(500).json({ success: false, message: "Failed to initialize purchase", error: error.message });
  }
});

// ── GET /api/coins/purchase/verify ──────────────────────────────────────────
// Verify Paystack payment and credit coins
router.get("/purchase/verify", async (req, res) => {
  try {
    const { reference } = req.query;
    if (!reference) return res.status(400).json({ success: false, message: "Reference is required" });

    const response = await paystack.get(`/transaction/verify/${reference}`);
    const txData = response.data.data;

    if (txData.status !== "success") {
      return res.status(400).json({ success: false, message: "Payment not successful" });
    }

    const { userId, packageId, coins } = txData.metadata;
    const pkg = getCoinPackageById(packageId);
    if (!pkg) return res.status(400).json({ success: false, message: "Invalid package in metadata" });

    // Idempotency: check if we already processed this reference
    const already = await prisma.coinTransaction.findFirst({
      where: { metadata: { path: ["reference"], equals: reference } },
    });
    if (already) {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { coinBalance: true } });
      return res.json({ success: true, message: "Already processed", data: { coinBalance: user.coinBalance } });
    }

    const totalCoins = pkg.coins; // includes any bonus already in package definition
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const newBalance = (user.coinBalance || 0) + totalCoins;

    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { coinBalance: newBalance } }),
      prisma.coinTransaction.create({
        data: {
          id: uuidV4(),
          userId,
          type: "purchase",
          amount: totalCoins,
          balanceAfter: newBalance,
          description: `Purchased ${pkg.label}`,
          metadata: { packageId, reference, paymentMethod: "paystack" },
        },
      }),
    ]);

    res.json({
      success: true,
      message: "Coins credited successfully",
      data: { coins: totalCoins, coinBalance: newBalance },
    });
  } catch (error) {
    console.error("Coin verify error:", error);
    res.status(500).json({ success: false, message: "Failed to verify payment", error: error.message });
  }
});

// ── POST /api/coins/purchase/verify-stripe ───────────────────────────────────
// Verify Stripe checkout session and credit coins
router.post("/purchase/verify-stripe", authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ success: false, message: "sessionId is required" });

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") {
      return res.status(400).json({ success: false, message: "Payment not completed" });
    }

    const { userId, packageId, reference } = session.metadata;
    const pkg = getCoinPackageById(packageId);
    if (!pkg) return res.status(400).json({ success: false, message: "Invalid package" });

    const already = await prisma.coinTransaction.findFirst({
      where: { metadata: { path: ["reference"], equals: reference } },
    });
    if (already) {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { coinBalance: true } });
      return res.json({ success: true, message: "Already processed", data: { coinBalance: user.coinBalance } });
    }

    const totalCoins = pkg.coins;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const newBalance = (user.coinBalance || 0) + totalCoins;

    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { coinBalance: newBalance } }),
      prisma.coinTransaction.create({
        data: {
          id: uuidV4(),
          userId,
          type: "purchase",
          amount: totalCoins,
          balanceAfter: newBalance,
          description: `Purchased ${pkg.label}`,
          metadata: { packageId, reference, sessionId, paymentMethod: "stripe" },
        },
      }),
    ]);

    res.json({
      success: true,
      message: "Coins credited successfully",
      data: { coins: totalCoins, coinBalance: newBalance },
    });
  } catch (error) {
    console.error("Stripe verify error:", error);
    res.status(500).json({ success: false, message: "Failed to verify Stripe payment", error: error.message });
  }
});

export default router;
