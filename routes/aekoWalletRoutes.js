import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import User from "../models/User.js";
import AekoTransaction from "../models/AekoTransaction.js";
import { getAekoBalance } from "../utils/solanaBlockchain.js";
import bs58 from "bs58";
import { Keypair } from "@solana/web3.js";

const router = express.Router();

/**
 * @swagger
 * /api/aeko/wallet-info:
 *   get:
 *     summary: Get AEKO-only wallet info (address and AEKO balance)
 *     tags: [Aeko Coin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: AEKO wallet info retrieved successfully
 *       404:
 *         description: Wallet not connected/imported
 */
router.get("/wallet-info", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user?.solanaWalletAddress) {
      return res.status(404).json({ success: false, message: "Wallet not connected" });
    }
    const aekoBalance = await getAekoBalance(user.solanaWalletAddress);
    user.aekoBalance = aekoBalance;
    await user.save();
    res.json({ success: true, data: { walletAddress: user.solanaWalletAddress, aekoBalance } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error getting wallet info" });
  }
});

/**
 * @swagger
 * /api/aeko/import-wallet:
 *   post:
 *     summary: Import AEKO wallet using a private key (AEKO-only operations)
 *     description: Derives the public address from a base58-encoded private key and links it to the user. Only AEKO token operations are supported.
 *     tags: [Aeko Coin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - privateKey
 *             properties:
 *               privateKey:
 *                 type: string
 *                 description: Base58-encoded Solana secret key
 *                 example: "3mB...base58Secret...Jx"
 *     responses:
 *       200:
 *         description: Wallet imported successfully
 *       400:
 *         description: Invalid private key
 */
router.post("/import-wallet", authMiddleware, async (req, res) => {
  try {
    const { privateKey } = req.body;
    if (!privateKey || typeof privateKey !== "string") {
      return res.status(400).json({ success: false, message: "privateKey is required" });
    }
    let keypair;
    try {
      keypair = Keypair.fromSecretKey(bs58.decode(privateKey));
    } catch (e) {
      return res.status(400).json({ success: false, message: "Invalid private key format" });
    }
    const publicKey = keypair.publicKey.toString();
    const existingUser = await User.findOne({ solanaWalletAddress: publicKey, _id: { $ne: req.user.id } });
    if (existingUser) {
      return res.status(400).json({ success: false, message: "Wallet already connected to another account" });
    }
    const user = await User.findById(req.user.id);
    user.solanaWalletAddress = publicKey;
    user.aekoBalance = await getAekoBalance(publicKey);
    await user.save();
    res.json({ success: true, message: "Wallet imported successfully", data: { walletAddress: publicKey, aekoBalance: user.aekoBalance } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error importing wallet" });
  }
});

/**
 * @swagger
 * /api/aeko/user/{userId}/transactions:
 *   get:
 *     summary: Get a user's blockchain transactions (AEKO, NFTs, donations, bids, tips, etc.)
 *     tags: [Aeko Coin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[a-fA-F0-9]{24}$'
 *         description: User ID whose transactions to fetch
 *       - in: query
 *         name: types
 *         schema:
 *           type: string
 *         description: Comma-separated list of transaction types (e.g., transfer,stream_donation,nft_purchase)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Max number of transactions to return (default 50)
 *     responses:
 *       200:
 *         description: Transactions retrieved successfully
 *       403:
 *         description: Forbidden for other users
 */
router.get("/user/:userId/transactions", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const { types, limit = 50 } = req.query;

    if (String(req.user.id) !== String(userId)) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const query = { $or: [{ fromUser: userId }, { toUser: userId }] };
    if (types) {
      const typeList = String(types).split(',').map(t => t.trim()).filter(Boolean);
      if (typeList.length) query.type = { $in: typeList };
    }

    const transactions = await AekoTransaction.find(query)
      .populate('fromUser', 'username profilePicture')
      .populate('toUser', 'username profilePicture')
      .populate('relatedStream', 'title')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json({ success: true, data: { transactions, count: transactions.length } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching transactions" });
  }
});

export default router;
