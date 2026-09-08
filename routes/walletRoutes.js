import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { connection, explorer, sendChainError } from "../chain/client.js";
import { aekoToLamports, lamportsToAeko, getMinBalanceForRentExemption, sendAndConfirmSigned } from "../chain/utils.js";
import { getCustodialKeypair, isCustodyConfigured } from "../chain/custodialKeypair.js";
import { decodeBase58 } from "@aeko-chain/web3.js";
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
    sendChainError(res, error, "Failed to link wallet");
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
    sendChainError(res, error, "Failed to unlink wallet");
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
    sendChainError(res, error, "Failed to fetch balance");
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
    sendChainError(res, error, "Failed to fetch history");
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
    sendChainError(res, error, "Failed to fetch NFTs");
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
    sendChainError(res, error, "Failed to prepare transfer");
  }
});

// ---------------------------------------------------------------------------
// Custodial wallet
//
// The backend holds the keys and signs on the user's behalf (see
// chain/custodialKeypair.js). The client never sees key material and simply
// asks for a transfer. Addresses are derived per user, so balances are not
// pooled.
//
// The routes below are the ones the mobile app actually calls. The
// prepare-*  routes above remain for a future non-custodial client.
// ---------------------------------------------------------------------------

/** Rejects anything that is not a 32-byte base58 public key. */
const isValidAddress = (address) => {
  if (typeof address !== "string" || address.length < 32 || address.length > 64) {
    return false;
  }
  try {
    return Buffer.from(decodeBase58(address)).length === 32;
  } catch {
    return false;
  }
};

/** Flat fee applied to withdrawals to an external address, in AEKO. */
const WITHDRAWAL_FEE_AEKO = 0.8;

// Guards every custodial route, not just transfers, and the message now
// reaches users directly — the app surfaces the server's `message`.
const custodyUnavailable = (res) =>
  res.status(503).json({
    success: false,
    message: "Wallet services are temporarily unavailable. Please try again shortly.",
    code: "CUSTODY_UNAVAILABLE",
  });

/**
 * Resolves the caller's custodial wallet, keeping User.walletAddress in step so
 * marketplace, staking and rewards lookups can find the same address.
 */
async function resolveCustodialWallet(userId) {
  const keypair = getCustodialKeypair(userId);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { walletAddress: true },
  });

  if (user?.walletAddress !== keypair.publicKey) {
    // updateMany avoids throwing on the unique constraint if a stale row
    // elsewhere still holds this address.
    await prisma.user
      .updateMany({ where: { id: userId }, data: { walletAddress: keypair.publicKey } })
      .catch((error) => console.error("wallet address sync failed:", error));
  }

  return keypair;
}

/**
 * @swagger
 * /api/wallet/summary:
 *   get:
 *     tags: [Wallet]
 *     summary: The caller's custodial wallet, balance and staking position
 *     security:
 *       - bearerAuth: []
 */
router.get("/summary", authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    if (!isCustodyConfigured()) return custodyUnavailable(res);

    const { publicKey } = await resolveCustodialWallet(userId);

    let balance = 0;
    try {
      balance = lamportsToAeko(await connection.getBalance(publicKey));
    } catch (error) {
      // A brand new address is unknown to the RPC until it is funded.
      console.error("wallet summary balance error:", error);
    }

    let stakingInfo = { balance: 0, rewards: 0, isStaking: false };
    try {
      const stakes = await explorer.listSocialStakes({ wallet: publicKey });
      const staked = (stakes ?? []).reduce((sum, s) => sum + (s.stakedAmount ?? 0), 0);
      const rewards = (stakes ?? []).reduce(
        (sum, s) => sum + ((s.accumulatedYield ?? 0) - (s.claimedYield ?? 0)),
        0,
      );
      stakingInfo = {
        balance: lamportsToAeko(staked),
        rewards: lamportsToAeko(rewards),
        isStaking: staked > 0,
      };
    } catch (error) {
      console.error("wallet summary staking error:", error);
    }

    res.json({
      wallets: [
        {
          id: publicKey,
          name: "Aeko Wallet",
          address: publicKey,
          balance,
          // No price oracle is wired up yet; report 0 rather than invent a rate.
          usdValue: 0,
          change24h: 0,
          isConnected: true,
          type: "aeko",
        },
      ],
      currentWalletId: publicKey,
      connectedWallets: [],
      stakingInfo,
    });
  } catch (error) {
    console.error("wallet summary error:", error);
    sendChainError(res, error, "Failed to load wallet");
  }
});

/**
 * @swagger
 * /api/wallet/transactions:
 *   get:
 *     tags: [Wallet]
 *     summary: Paged on-chain transaction history for the caller's wallet
 *     security:
 *       - bearerAuth: []
 */
router.get("/transactions", authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    if (!isCustodyConfigured()) return custodyUnavailable(res);

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));

    const { publicKey } = await resolveCustodialWallet(userId);

    let raw = [];
    try {
      const detail = await explorer.getAccountDetail(publicKey);
      raw = detail?.recentTransactions ?? [];
    } catch (error) {
      console.error("wallet transactions error:", error);
    }

    // Page over the explorer result. The explorer has no cursor API, so this
    // slices what it returns rather than pretending to page server-side.
    const start = (page - 1) * limit;
    const slice = raw.slice(start, start + limit);

    const transactions = slice.map((tx, index) => {
      const incoming = tx.to === publicKey;
      const amount = lamportsToAeko(Math.abs(Number(tx.lamports ?? tx.amount ?? 0)));
      return {
        id: tx.signature ?? `${publicKey}-${start + index}`,
        type: incoming ? "received" : "sent",
        title: incoming ? "Received" : "Sent",
        subtitle: incoming ? tx.from : tx.to,
        amount,
        timestamp: tx.blockTime
          ? new Date(Number(tx.blockTime) * 1000).toISOString()
          : new Date().toISOString(),
        isPositive: incoming,
      };
    });

    res.json({ transactions, page, hasMore: raw.length > start + limit });
  } catch (error) {
    console.error("wallet transactions error:", error);
    sendChainError(res, error, "Failed to load transactions");
  }
});

/**
 * Shared implementation for transfer and withdraw. `feeAeko` is deducted from
 * the sender in addition to `amountAeko` and is retained by the platform's
 * service account.
 */
async function performCustodialTransfer({ userId, toAddress, amountAeko, feeAeko = 0 }) {
  if (!isValidAddress(toAddress)) {
    return { status: 400, body: { success: false, message: "Invalid destination address" } };
  }

  const amount = Number(amountAeko);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { status: 400, body: { success: false, message: "Amount must be greater than 0" } };
  }

  const signer = await resolveCustodialWallet(userId);

  if (toAddress === signer.publicKey) {
    return { status: 400, body: { success: false, message: "Cannot send to your own wallet" } };
  }

  const lamports = aekoToLamports(amount);
  const feeLamports = aekoToLamports(feeAeko);
  const balance = await connection.getBalance(signer.publicKey);

  if (balance < lamports + feeLamports) {
    return {
      status: 400,
      body: {
        success: false,
        message: "Insufficient balance",
        balance: lamportsToAeko(balance),
        required: lamportsToAeko(lamports + feeLamports),
      },
    };
  }

  const blockhash = await connection.getLatestBlockhash();
  const instructions = [
    buildSystemTransferInstruction(signer.publicKey, toAddress, lamports),
  ];

  if (feeLamports > 0) {
    const { serviceKeypair } = await import("../chain/serviceKeypair.js");
    instructions.push(
      buildSystemTransferInstruction(signer.publicKey, serviceKeypair.publicKey, feeLamports),
    );
  }

  const txBase64 = buildPreparedMultiInstructionTransaction({
    payer: signer.publicKey,
    recentBlockhash: blockhash,
    instructions,
  });

  const signature = await sendAndConfirmSigned(connection, txBase64, signer);

  return {
    status: 200,
    body: {
      success: true,
      signature,
      from: signer.publicKey,
      to: toAddress,
      amount,
      fee: feeAeko,
    },
  };
}

/**
 * @swagger
 * /api/wallet/transfer:
 *   post:
 *     tags: [Wallet]
 *     summary: Send AEKO from the caller's custodial wallet
 *     security:
 *       - bearerAuth: []
 */
router.post("/transfer", authMiddleware, async (req, res) => {
  try {
    if (!isCustodyConfigured()) return custodyUnavailable(res);
    const userId = req.user?.id || req.userId;
    const { toAddress, amountAeko } = req.body || {};

    const { status, body } = await performCustodialTransfer({
      userId,
      toAddress,
      amountAeko,
    });
    res.status(status).json(body);
  } catch (error) {
    console.error("wallet transfer error:", error);
    sendChainError(res, error, "Transfer failed");
  }
});

/**
 * @swagger
 * /api/wallet/withdraw:
 *   post:
 *     tags: [Wallet]
 *     summary: Withdraw AEKO to an external address (a transfer plus a flat fee)
 *     security:
 *       - bearerAuth: []
 */
router.post("/withdraw", authMiddleware, async (req, res) => {
  try {
    if (!isCustodyConfigured()) return custodyUnavailable(res);
    const userId = req.user?.id || req.userId;
    const { toAddress, amountAeko } = req.body || {};

    const { status, body } = await performCustodialTransfer({
      userId,
      toAddress,
      amountAeko,
      feeAeko: WITHDRAWAL_FEE_AEKO,
    });
    res.status(status).json(body);
  } catch (error) {
    console.error("wallet withdraw error:", error);
    sendChainError(res, error, "Withdrawal failed");
  }
});

export default router;
