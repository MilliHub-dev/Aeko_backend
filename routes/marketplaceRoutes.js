import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { connection, sendChainError } from "../chain/client.js";
import { presentListings } from "../services/nftPresenter.js";
import { aekoToLamports, lamportsToAeko, deriveWithSeed, getMinBalanceForRentExemption, sendAndConfirmSigned } from "../chain/utils.js";
import { getCustodialKeypair, isCustodyConfigured } from "../chain/custodialKeypair.js";
import {
  buildPreparedMultiInstructionTransaction,
  buildPreparedTransactionWithSigners,
  buildSystemTransferInstruction,
  buildToken721TransferInstruction,
  buildBuyNftInstruction,
  signPreparedTransaction,
} from "../chain/txBuilder.js";
import { prisma } from "../config/db.js";
import {
  PROGRAM_IDS,
  encodeBase58,
  decodeBase58,
  buildPreparedListNftTransaction,
  buildPreparedCancelListingTransaction,
  sendAndConfirmTransaction,
} from "@aeko-chain/web3.js";

const router = express.Router();

const PLATFORM_FEE_BPS     = Number(process.env.AEKO_PLATFORM_FEE_BPS) || 200;
const TREASURY_ADDRESS     = process.env.AEKO_TREASURY_ADDRESS;
const LISTING_ACCOUNT_SIZE = 256;

// ── Listing account deserializer ───────────────────────────────────────────────
function readU64LE(buf, off) { return Number(buf.readBigUInt64LE(off)); }
function readPubkey(buf, off) { return encodeBase58(buf.slice(off, off + 32)); }

function deserializeListing(data) {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
  let off = 0;
  const seller        = readPubkey(buf, off); off += 32;
  const collection    = readPubkey(buf, off); off += 32;
  const tokenAccount  = readPubkey(buf, off); off += 32;
  const creator       = readPubkey(buf, off); off += 32;
  const priceLamports = readU64LE(buf, off);  off += 8;
  const royaltyBps    = buf.readUInt16LE(off); off += 2;
  const hasExpiry     = buf[off++];
  if (hasExpiry) off += 8;
  const stateIdx = buf[off++];
  const state    = ["Active", "Sold", "Cancelled"][stateIdx] ?? "Unknown";
  return { seller, collection, tokenAccount, creator, priceLamports, priceAeko: lamportsToAeko(priceLamports), royaltyBps, state };
}

/**
 * Whether the validator runs the token-721 and marketplace programs. Native
 * programs show up as executable accounts owned by the native loader; the
 * result is cached because it only changes with a validator upgrade.
 */
let nftProgramsCheckedAt = 0;
let nftProgramsPresent = false;
async function nftProgramsAvailable() {
  if (nftProgramsPresent) return true;
  if (Date.now() - nftProgramsCheckedAt < 60_000) return nftProgramsPresent;
  nftProgramsCheckedAt = Date.now();
  const infos = await Promise.all(
    [PROGRAM_IDS.TOKEN_721, PROGRAM_IDS.NFT_MARKETPLACE].map((id) => connection.getAccountInfo(id)),
  );
  nftProgramsPresent = infos.every((info) => info?.executable === true);
  return nftProgramsPresent;
}

async function fetchListing(listingId) {
  const info = await connection.getAccountInfo(listingId);
  if (!info?.data) return null;
  const raw = Array.isArray(info.data) ? Buffer.from(info.data[0], "base64") : Buffer.from(info.data);
  return deserializeListing(raw);
}

/**
 * @swagger
 * /api/marketplace/listings:
 *   get:
 *     tags: [Marketplace]
 *     summary: Get active NFT marketplace listings
 *     parameters:
 *       - in: query
 *         name: seller
 *         schema: { type: string }
 *       - in: query
 *         name: collection
 *         schema: { type: string }
 *       - in: query
 *         name: minPrice
 *         schema: { type: number }
 *       - in: query
 *         name: maxPrice
 *         schema: { type: number }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 25 }
 *     responses:
 *       200:
 *         description: Active listings
 */
router.get("/listings", async (req, res) => {
  try {
    const { seller, collection, tokenAccount, minPrice, maxPrice, limit } = req.query;

    const accounts = await connection.getProgramAccounts(PROGRAM_IDS.NFT_MARKETPLACE);
    let listings = accounts
      .map(({ pubkey, account }) => {
        const raw = Array.isArray(account.data)
          ? Buffer.from(account.data[0], "base64")
          : Buffer.from(account.data);
        return { ...deserializeListing(raw), listingId: pubkey };
      })
      .filter(l => l.state === "Active");

    if (seller)     listings = listings.filter(l => l.seller === seller);
    if (collection) listings = listings.filter(l => l.collection === collection);
    // Lets an NFT's detail screen ask "is this token for sale?" without pulling every listing.
    if (tokenAccount) listings = listings.filter(l => l.tokenAccount === tokenAccount);
    if (minPrice)   listings = listings.filter(l => l.priceAeko >= Number(minPrice));
    if (maxPrice)   listings = listings.filter(l => l.priceAeko <= Number(maxPrice));

    const page = listings.slice(0, Number(limit) || 25);
    // `listings` stays raw for existing callers; `nfts` is the same page with
    // names, images and resolved sellers, which listings alone do not carry.
    res.json({
      success: true,
      listings: page,
      nfts: await presentListings(page),
      platformFeeBps: PLATFORM_FEE_BPS,
    });
  } catch (error) {
    console.error("marketplace listings error:", error);
    sendChainError(res, error, "Failed to fetch listings");
  }
});

/**
 * @swagger
 * /api/marketplace/prepare-list:
 *   post:
 *     tags: [Marketplace]
 *     summary: Prepare an unsigned NFT listing transaction
 *     description: |
 *       Returns a single unsigned transaction containing two instructions:
 *       1. `CreateAccountWithSeed` — pre-allocates the listing account (256 bytes)
 *       2. `ListNft` — registers the listing on-chain
 *
 *       The listing account address is derived deterministically. Seller is the only signer.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [collectionAccount, tokenAccount, creatorAddress, priceAeko]
 *             properties:
 *               collectionAccount: { type: string }
 *               tokenAccount: { type: string }
 *               creatorAddress: { type: string, description: "Original NFT creator (for royalty routing)" }
 *               priceAeko: { type: number, example: 50 }
 *               royaltyBps: { type: integer, example: 500 }
 *               expiresInDays: { type: integer, example: 30 }
 *     responses:
 *       200:
 *         description: Unsigned listing transaction
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 txBase64: { type: string, description: "Sign with seller's wallet key only" }
 *                 listingAccount: { type: string }
 *       400:
 *         description: Missing fields or no wallet linked
 *       401:
 *         description: Unauthorized
 */
router.post("/prepare-list", authMiddleware, async (req, res) => {
  try {
    const { collectionAccount, tokenAccount, creatorAddress, priceAeko, royaltyBps, expiresInDays } = req.body;
    const seller = req.user.walletAddress;

    if (!seller) return res.status(400).json({ success: false, message: "No wallet address linked to your account" });
    if (!collectionAccount || !tokenAccount || !priceAeko || !creatorAddress) {
      return res.status(400).json({ success: false, message: "collectionAccount, tokenAccount, creatorAddress, and priceAeko are required" });
    }

    const seed            = `listing:${tokenAccount}`.slice(0, 32);
    const listingAccount  = deriveWithSeed(seller, seed, PROGRAM_IDS.NFT_MARKETPLACE);
    const lamports        = await getMinBalanceForRentExemption(connection, LISTING_ACCOUNT_SIZE);
    const priceLamports   = aekoToLamports(priceAeko);
    const blockhash       = await connection.getLatestBlockhash();
    const expiresAtSlot   = expiresInDays ? Math.floor(expiresInDays * 24 * 3600 * 2.5) : null;

    const txBase64 = buildPreparedListNftTransaction({
      payer:           seller,
      recentBlockhash: blockhash,
      listingAccount,
      tokenAccount,
      seller,
      collection:      collectionAccount,
      creator:         creatorAddress,
      priceLamports,
      royaltyBps:      royaltyBps ?? 0,
      expiresAtSlot,
    });

    res.json({ success: true, txBase64, listingAccount });
  } catch (error) {
    console.error("prepare-list error:", error);
    sendChainError(res, error, "Failed to prepare listing transaction");
  }
});

/**
 * @swagger
 * /api/marketplace/prepare-buy:
 *   post:
 *     tags: [Marketplace]
 *     summary: Prepare an unsigned NFT buy transaction
 *     description: |
 *       Returns a single unsigned transaction containing four atomic instructions:
 *       1. **System transfer** — buyer → seller (price - royalty - platform fee)
 *       2. **System transfer** — buyer → creator (royalty)
 *       3. **System transfer** — buyer → treasury (platform fee)
 *       4. **BuyNft** — marks listing as Sold (validates listing is still Active)
 *
 *       All four succeed or roll back together.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [listingId]
 *             properties:
 *               listingId: { type: string, example: "AeKoListing..." }
 *     responses:
 *       200:
 *         description: Unsigned buy transaction with price breakdown
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 txBase64: { type: string }
 *                 breakdown:
 *                   type: object
 *                   properties:
 *                     price: { type: number }
 *                     royalty: { type: number }
 *                     platformFee: { type: number }
 *                     sellerGets: { type: number }
 *       400:
 *         description: Listing not available
 *       401:
 *         description: Unauthorized
 */
router.post("/prepare-buy", authMiddleware, async (req, res) => {
  try {
    const { listingId } = req.body;
    const buyer = req.user.walletAddress;

    if (!buyer)     return res.status(400).json({ success: false, message: "No wallet address linked to your account" });
    if (!listingId) return res.status(400).json({ success: false, message: "listingId is required" });
    if (!TREASURY_ADDRESS) return res.status(500).json({ success: false, message: "Platform treasury not configured" });

    const listing = await fetchListing(listingId);
    if (!listing || listing.state !== "Active") return res.status(400).json({ success: false, message: "Listing not available" });

    const { priceLamports, royaltyBps, seller, creator } = listing;
    const royaltyLamports     = Math.floor(priceLamports * royaltyBps / 10_000);
    const platformFeeLamports = Math.floor(priceLamports * PLATFORM_FEE_BPS / 10_000);
    const sellerLamports      = priceLamports - royaltyLamports - platformFeeLamports;
    const blockhash           = await connection.getLatestBlockhash();

    const instructions = [
      buildSystemTransferInstruction(buyer, seller,           sellerLamports),
      buildSystemTransferInstruction(buyer, creator,          royaltyLamports),
      buildSystemTransferInstruction(buyer, TREASURY_ADDRESS, platformFeeLamports),
      buildBuyNftInstruction(listingId, buyer),
    ];

    const txBase64 = buildPreparedMultiInstructionTransaction({ payer: buyer, recentBlockhash: blockhash, instructions });

    res.json({
      success: true,
      txBase64,
      breakdown: {
        price:       listing.priceAeko,
        royalty:     lamportsToAeko(royaltyLamports),
        platformFee: lamportsToAeko(platformFeeLamports),
        sellerGets:  lamportsToAeko(sellerLamports),
      },
    });
  } catch (error) {
    console.error("prepare-buy error:", error);
    sendChainError(res, error, "Failed to prepare buy transaction");
  }
});

/**
 * @swagger
 * /api/marketplace/prepare-cancel:
 *   post:
 *     tags: [Marketplace]
 *     summary: Prepare an unsigned listing cancellation transaction
 *     description: Only the seller of the listing can cancel it. Listing must be Active.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [listingId]
 *             properties:
 *               listingId: { type: string, example: "AeKoListing..." }
 *     responses:
 *       200:
 *         description: Unsigned cancel transaction
 *       400:
 *         description: Listing not available
 *       403:
 *         description: Not the seller
 *       401:
 *         description: Unauthorized
 */
router.post("/prepare-cancel", authMiddleware, async (req, res) => {
  try {
    const { listingId } = req.body;
    const seller = req.user.walletAddress;

    if (!seller)    return res.status(400).json({ success: false, message: "No wallet address linked to your account" });
    if (!listingId) return res.status(400).json({ success: false, message: "listingId is required" });

    const listing = await fetchListing(listingId);
    if (!listing || listing.state !== "Active") return res.status(400).json({ success: false, message: "Listing not available" });
    if (listing.seller !== seller) return res.status(403).json({ success: false, message: "You are not the seller of this listing" });

    const blockhash = await connection.getLatestBlockhash();
    const txBase64  = buildPreparedCancelListingTransaction({
      payer:           seller,
      recentBlockhash: blockhash,
      listingAccount:  listingId,
      seller,
    });

    res.json({ success: true, txBase64 });
  } catch (error) {
    console.error("prepare-cancel error:", error);
    sendChainError(res, error, "Failed to prepare cancel transaction");
  }
});

/**
 * @swagger
 * /api/marketplace/buy:
 *   post:
 *     tags: [Marketplace]
 *     summary: Buy a listing using the caller's custodial wallet
 *     description: |
 *       Custodial counterpart to prepare-buy. The backend derives the buyer's
 *       key, signs and submits, so the client never handles key material.
 *       Fee split (royalty, platform fee, seller proceeds) is identical.
 *     security:
 *       - bearerAuth: []
 */
router.post("/buy", authMiddleware, async (req, res) => {
  try {
    if (!isCustodyConfigured()) {
      return res.status(503).json({ success: false, message: "Purchases are temporarily unavailable." });
    }

    const { listingId } = req.body || {};
    if (!listingId) return res.status(400).json({ success: false, message: "listingId is required" });
    if (!TREASURY_ADDRESS) return res.status(500).json({ success: false, message: "Platform treasury not configured" });

    // The token-721 and marketplace programs are native to the validator. If
    // this chain does not run them, no purchase can ever settle, so say so
    // instead of submitting a transaction that can only fail.
    if (!(await nftProgramsAvailable())) {
      return res.status(503).json({
        success: false,
        message: "NFT trading isn't available on the Aeko chain yet.",
        code: "NFT_MARKETPLACE_UNAVAILABLE",
      });
    }

    const userId = req.user?.id || req.userId;
    const buyerSigner = getCustodialKeypair(userId);
    const buyer = buyerSigner.publicKey;

    const listing = await fetchListing(listingId);
    if (!listing || listing.state !== "Active") {
      return res.status(400).json({ success: false, message: "Listing not available" });
    }
    if (listing.seller === buyer) {
      return res.status(400).json({ success: false, message: "You already own this listing" });
    }

    const { priceLamports, royaltyBps, seller, creator, tokenAccount } = listing;

    // The NFT transfer must be signed by its owner. Every wallet here is
    // custodial, so the seller's key can be derived as long as the address
    // belongs to an Aeko account; a listing from an external wallet has no one
    // to sign for it.
    const sellerUser = await prisma.user.findFirst({
      where: { walletAddress: seller },
      select: { id: true },
    });
    if (!sellerUser) {
      return res.status(400).json({
        success: false,
        message: "This listing can't be bought in the app because its seller isn't an Aeko wallet.",
        code: "SELLER_NOT_CUSTODIAL",
      });
    }
    const sellerSigner = getCustodialKeypair(sellerUser.id);
    if (sellerSigner.publicKey !== seller) {
      // The saved address does not derive from that account (linked, not custodial).
      return res.status(400).json({
        success: false,
        message: "This listing can't be bought in the app because its seller isn't an Aeko wallet.",
        code: "SELLER_NOT_CUSTODIAL",
      });
    }

    const royaltyLamports = Math.floor((priceLamports * royaltyBps) / 10_000);
    const platformFeeLamports = Math.floor((priceLamports * PLATFORM_FEE_BPS) / 10_000);
    const sellerLamports = priceLamports - royaltyLamports - platformFeeLamports;

    const balance = await connection.getBalance(buyer);
    if (balance < priceLamports) {
      return res.status(400).json({
        success: false,
        message: "Insufficient balance",
        balance: lamportsToAeko(balance),
        required: lamportsToAeko(priceLamports),
      });
    }

    // One atomic transaction: payment, royalty, platform fee, the NFT itself,
    // and the listing marked Sold. If any part fails nothing moves. The
    // previous version sent only the payments, so the buyer paid and the
    // seller kept the token with the listing still Active.
    const blockhash = await connection.getLatestBlockhash();
    const instructions = [
      buildSystemTransferInstruction(buyer, seller, sellerLamports),
      buildSystemTransferInstruction(buyer, TREASURY_ADDRESS, platformFeeLamports),
    ];
    if (royaltyLamports > 0 && creator && creator !== seller) {
      instructions.push(buildSystemTransferInstruction(buyer, creator, royaltyLamports));
    }
    instructions.push(
      buildToken721TransferInstruction(tokenAccount, seller, buyer),
      buildBuyNftInstruction(listingId, buyer),
    );

    const { txBase64 } = buildPreparedTransactionWithSigners({
      payer: buyer,
      recentBlockhash: blockhash,
      instructions,
    });
    const signedTx = signPreparedTransaction(txBase64, [buyerSigner, sellerSigner]);

    // Dry run first: a rejected purchase should come back as a clear error,
    // not as a failed transaction the user has to go and look up.
    const simulation = await connection.rpc("simulateTransaction", [
      signedTx,
      { encoding: "base64", sigVerify: true, commitment: "processed" },
    ]);
    if (simulation?.value?.err) {
      console.error("marketplace buy simulation failed:", JSON.stringify(simulation.value.err), simulation.value.logs);
      return res.status(400).json({
        success: false,
        message: "The chain rejected this purchase. Nothing was charged.",
        code: "PURCHASE_REJECTED",
      });
    }

    const result = await sendAndConfirmTransaction(connection, signedTx);
    if (result.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(result.err)}`);
    }

    res.json({
      success: true,
      signature: result.signature,
      listingId,
      tokenAccount,
      breakdown: {
        price: listing.priceAeko,
        royalty: lamportsToAeko(royaltyLamports),
        platformFee: lamportsToAeko(platformFeeLamports),
        sellerGets: lamportsToAeko(sellerLamports),
      },
    });
  } catch (error) {
    console.error("marketplace buy error:", error);
    sendChainError(res, error, "Purchase failed");
  }
});

export default router;
