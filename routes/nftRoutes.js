import express from "express";
import multer from "multer";
import authMiddleware from "../middleware/authMiddleware.js";
import { connection, explorer } from "../chain/client.js";
import { getMinBalanceForRentExemption, deriveWithSeed } from "../chain/utils.js";
import {
  PROGRAM_IDS,
  buildPreparedMintWithAccountSetupTransaction,
  buildPreparedToken721Transaction,
  estimateTokenAccountSpace,
} from "@aeko-chain/web3.js";
import { uploadNftMetadata } from "../services/ipfsService.js";

const router = express.Router();
const memoryUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

/**
 * @swagger
 * /api/nfts:
 *   get:
 *     tags: [NFTs]
 *     summary: List NFTs with optional filters
 *     parameters:
 *       - in: query
 *         name: owner
 *         schema: { type: string }
 *       - in: query
 *         name: collection
 *         schema: { type: string }
 *       - in: query
 *         name: creator
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 25 }
 *     responses:
 *       200:
 *         description: List of NFTs
 */
router.get("/", async (req, res) => {
  try {
    const { owner, collection, creator, limit } = req.query;
    const nfts = await explorer.listNfts({ owner, collection, creator, limit: Number(limit) || 25 });
    res.json({ success: true, nfts });
  } catch (error) {
    console.error("list nfts error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch NFTs" });
  }
});

/**
 * @swagger
 * /api/nfts/collections/{collectionId}:
 *   get:
 *     tags: [NFTs]
 *     summary: Get a single NFT collection
 *     parameters:
 *       - in: path
 *         name: collectionId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Collection details
 *       404:
 *         description: Collection not found
 */
router.get("/collections/:collectionId", async (req, res) => {
  try {
    const collection = await explorer.getCollection(req.params.collectionId);
    if (!collection) return res.status(404).json({ success: false, message: "Collection not found" });
    res.json({ success: true, collection });
  } catch (error) {
    console.error("get collection error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch collection" });
  }
});

/**
 * @swagger
 * /api/nfts/{tokenId}:
 *   get:
 *     tags: [NFTs]
 *     summary: Get a single NFT by token ID
 *     parameters:
 *       - in: path
 *         name: tokenId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: NFT details
 *       404:
 *         description: NFT not found
 */
router.get("/:tokenId", async (req, res) => {
  try {
    const nft = await explorer.getNft(req.params.tokenId);
    if (!nft) return res.status(404).json({ success: false, message: "NFT not found" });
    res.json({ success: true, nft });
  } catch (error) {
    console.error("get nft error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch NFT" });
  }
});

/**
 * @swagger
 * /api/nfts/upload-metadata:
 *   post:
 *     tags: [NFTs]
 *     summary: Upload NFT image and metadata to IPFS
 *     description: |
 *       Call this before `prepare-mint`. Uploads image + metadata JSON to IPFS via Pinata
 *       and returns the `uri` and `imageUri` needed by the mint transaction.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [image, name]
 *             properties:
 *               image: { type: string, format: binary }
 *               name: { type: string, example: "My NFT #1" }
 *               description: { type: string }
 *               attributes:
 *                 type: string
 *                 description: JSON string of attribute array
 *                 example: '[{"trait_type":"Rarity","value":"Rare"}]'
 *     responses:
 *       200:
 *         description: IPFS URIs ready for prepare-mint
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 uri: { type: string, example: "ipfs://Qm..." }
 *                 imageUri: { type: string, example: "ipfs://Qm..." }
 *       400:
 *         description: Missing image or name
 *       401:
 *         description: Unauthorized
 */
router.post("/upload-metadata", authMiddleware, memoryUpload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "image file is required" });
    const { name, description = "", attributes } = req.body;
    if (!name) return res.status(400).json({ success: false, message: "name is required" });

    const parsedAttributes = attributes ? JSON.parse(attributes) : [];
    const { uri, imageUri } = await uploadNftMetadata({
      imageBuffer:   req.file.buffer,
      imageMimeType: req.file.mimetype,
      imageFilename: req.file.originalname,
      name,
      description,
      attributes: parsedAttributes,
    });

    res.json({ success: true, uri, imageUri });
  } catch (error) {
    console.error("upload-metadata error:", error);
    res.status(500).json({ success: false, message: "Failed to upload metadata to IPFS" });
  }
});

/**
 * @swagger
 * /api/nfts/prepare-mint:
 *   post:
 *     tags: [NFTs]
 *     summary: Prepare an unsigned NFT mint transaction
 *     description: |
 *       Call `upload-metadata` first to get `uri` and `imageUri`, then pass them in `metadata`.
 *       The token account is derived deterministically via a seed — only the creator signs once.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [creator, collectionAccount, metadata]
 *             properties:
 *               creator: { type: string, example: "AeKo1234...creator" }
 *               collectionAccount: { type: string, example: "AeKoCollect..." }
 *               royaltyBps: { type: integer, example: 500 }
 *               metadata:
 *                 type: object
 *                 properties:
 *                   name: { type: string }
 *                   uri: { type: string, example: "ipfs://Qm..." }
 *                   imageUri: { type: string, example: "ipfs://Qm..." }
 *                   attributes: { type: array, items: { type: object } }
 *     responses:
 *       200:
 *         description: Unsigned transaction — sign with creator key only
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 txBase64: { type: string }
 *                 tokenAccount: { type: string, description: "Derived token account address" }
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Unauthorized
 */
router.post("/prepare-mint", authMiddleware, async (req, res) => {
  try {
    const { creator, collectionAccount, royaltyBps, metadata } = req.body;
    if (!creator || !collectionAccount || !metadata) {
      return res.status(400).json({ success: false, message: "creator, collectionAccount, and metadata are required" });
    }

    const tokenId      = Date.now();
    const tokenSeed    = `nft:${tokenId}`.slice(0, 32);
    const tokenAccount = deriveWithSeed(creator, tokenSeed, PROGRAM_IDS.TOKEN_721);
    const space        = estimateTokenAccountSpace({ metadata });
    const lamports     = await getMinBalanceForRentExemption(connection, space);
    const blockhash    = await connection.getLatestBlockhash();

    const txBase64 = buildPreparedMintWithAccountSetupTransaction({
      payer:           creator,
      recentBlockhash: blockhash,
      tokenAddress:    tokenAccount,
      base:            creator,
      tokenSeed,
      lamports,
      space,
      collection:      collectionAccount,
      authority:       creator,
      owner:           creator,
      tokenId,
      royaltyBps:      royaltyBps ?? 0,
      metadata,
    });

    res.json({ success: true, txBase64, tokenAccount });
  } catch (error) {
    console.error("prepare-mint error:", error);
    res.status(500).json({ success: false, message: "Failed to prepare mint transaction" });
  }
});

/**
 * @swagger
 * /api/nfts/prepare-transfer:
 *   post:
 *     tags: [NFTs]
 *     summary: Prepare an unsigned NFT transfer transaction
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tokenAccount, currentOwner, newOwner]
 *             properties:
 *               tokenAccount: { type: string, example: "AeKoToken..." }
 *               currentOwner: { type: string, example: "AeKo1234...owner" }
 *               newOwner: { type: string, example: "AeKo5678...newowner" }
 *     responses:
 *       200:
 *         description: Unsigned transfer transaction
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Unauthorized
 */
router.post("/prepare-transfer", authMiddleware, async (req, res) => {
  try {
    const { tokenAccount, currentOwner, newOwner } = req.body;
    if (!tokenAccount || !currentOwner || !newOwner) {
      return res.status(400).json({ success: false, message: "tokenAccount, currentOwner, and newOwner are required" });
    }

    const blockhash = await connection.getLatestBlockhash();
    const txBase64  = buildPreparedToken721Transaction({
      payer:           currentOwner,
      recentBlockhash: blockhash,
      action:          "transfer",
      token:           tokenAccount,
      owner:           currentOwner,
      recipient:       newOwner,
    });

    res.json({ success: true, txBase64 });
  } catch (error) {
    console.error("prepare-transfer nft error:", error);
    res.status(500).json({ success: false, message: "Failed to prepare NFT transfer transaction" });
  }
});

export default router;
