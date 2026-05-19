import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { connection, explorer } from "../chain/client.js";
import { aekoToLamports, lamportsToAeko, getMinBalanceForRentExemption } from "../chain/utils.js";
import { buildPreparedMultiInstructionTransaction, buildSystemTransferInstruction } from "../chain/txBuilder.js";
import { prisma } from "../config/db.js";

const router = express.Router();

/**
 * @swagger
 * /api/wallet/link:
 *   post:
 *     tags: [Wallet]
 *     summary: Link a wallet address to the authenticated user's account
 *     description: |
 *       Call this once after the user creates or imports their wallet on the frontend.
 *       The wallet address is stored in the backend DB so that marketplace, staking, and
 *       rewards endpoints can identify the user's on-chain identity.
 *
 *       The private key is **never** sent here — only the public wallet address.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [walletAddress]
 *             properties:
 *               walletAddress:
 *                 type: string
 *                 description: User's public wallet address (base58)
 *                 example: "AeKo1234...pubkey"
 *     responses:
 *       200:
 *         description: Wallet linked successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 walletAddress: { type: string }
 *       400:
 *         description: Missing walletAddress or address already linked to another account
 *       401:
 *         description: Unauthorized
 */
router.post("/link", authMiddleware, async (req, res) => {
  try {
    const { walletAddress } = req.body;
    if (!walletAddress) {
      return res.status(400).json({ success: false, message: "walletAddress is required" });
    }
    const userId = req.user?.id || req.userId;
    await prisma.user.update({ where: { id: userId }, data: { walletAddress } });
    res.json({ success: true, walletAddress });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(400).json({ success: false, message: "This wallet address is already linked to another account" });
    }
    console.error("wallet link error:", error);
    res.status(500).json({ success: false, message: "Failed to link wallet" });
  }
});

/**
 * @swagger
 * /api/wallet/link:
 *   delete:
 *     tags: [Wallet]
 *     summary: Unlink the wallet address from the authenticated user's account
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Wallet unlinked
 *       401:
 *         description: Unauthorized
 */
router.delete("/link", authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    await prisma.user.update({ where: { id: userId }, data: { walletAddress: null } });
    res.json({ success: true });
  } catch (error) {
    console.error("wallet unlink error:", error);
    res.status(500).json({ success: false, message: "Failed to unlink wallet" });
  }
});

/**
 * @swagger
 * /api/wallet/{address}/balance:
 *   get:
 *     tags: [Wallet]
 *     summary: Get wallet AEKO balance
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Wallet balance
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 address: { type: string }
 *                 lamports: { type: integer, example: 5000000000 }
 *                 aeko: { type: number, example: 5.0 }
 */
router.get("/:address/balance", async (req, res) => {
  try {
    const { address } = req.params;
    const lamports = await connection.getBalance(address);
    res.json({ success: true, address, lamports, aeko: lamportsToAeko(lamports) });
  } catch (error) {
    console.error("wallet balance error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch balance" });
  }
});

/**
 * @swagger
 * /api/wallet/{address}/history:
 *   get:
 *     tags: [Wallet]
 *     summary: Get wallet transaction history
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Wallet history
 */
router.get("/:address/history", async (req, res) => {
  try {
    const { address } = req.params;
    const limit = Number(req.query.limit) || 20;
    const data = await explorer.getAccountDetail(address);
    res.json({
      success: true,
      transactions: (data.recentTransactions ?? []).slice(0, limit),
      posts:    data.recentPosts    ?? [],
      stakes:   data.socialStakes   ?? [],
      rewards:  data.creatorRewards ?? [],
    });
  } catch (error) {
    console.error("wallet history error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch history" });
  }
});

/**
 * @swagger
 * /api/wallet/{address}/nfts:
 *   get:
 *     tags: [Wallet]
 *     summary: Get NFTs owned by a wallet
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List of NFTs
 */
router.get("/:address/nfts", async (req, res) => {
  try {
    const { address } = req.params;
    const nfts = await explorer.listNfts({ owner: address });
    res.json({ success: true, nfts });
  } catch (error) {
    console.error("wallet nfts error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch NFTs" });
  }
});

/**
 * @swagger
 * /api/wallet/prepare-transfer:
 *   post:
 *     tags: [Wallet]
 *     summary: Prepare an unsigned AEKO transfer transaction
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [from, to, amountAeko]
 *             properties:
 *               from: { type: string, example: "AeKo1234...sender" }
 *               to: { type: string, example: "AeKo5678...recipient" }
 *               amountAeko: { type: number, example: 10.5 }
 *     responses:
 *       200:
 *         description: Unsigned transaction ready for signing
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 txBase64: { type: string }
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Unauthorized
 */
router.post("/prepare-transfer", authMiddleware, async (req, res) => {
  try {
    const { from, to, amountAeko } = req.body;
    if (!from || !to || !amountAeko) {
      return res.status(400).json({ success: false, message: "from, to, and amountAeko are required" });
    }

    const lamports     = aekoToLamports(amountAeko);
    const blockhash    = await connection.getLatestBlockhash();
    const instruction  = buildSystemTransferInstruction(from, to, lamports);
    const txBase64     = buildPreparedMultiInstructionTransaction({
      payer: from, recentBlockhash: blockhash, instructions: [instruction],
    });

    res.json({ success: true, txBase64 });
  } catch (error) {
    console.error("prepare-transfer error:", error);
    res.status(500).json({ success: false, message: "Failed to prepare transfer" });
  }
});

export default router;
