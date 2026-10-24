import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { connection as defaultConnection, explorer as defaultExplorer, getConnection, getExplorer, listNetworks, NETWORKS, resolveNetwork, sendChainError } from "../chain/client.js";
import { presentNfts } from "../services/nftPresenter.js";
import { aekoToLamports, lamportsToAeko, getMinBalanceForRentExemption, sendAndConfirmSigned } from "../chain/utils.js";
import { getCustodialKeypair, isCustodyConfigured } from "../chain/custodialKeypair.js";
import { decodeBase58 } from "@aeko-chain/web3.js";
import { buildPreparedMultiInstructionTransaction, buildSystemTransferInstruction } from "../chain/txBuilder.js";
import { prisma } from "../config/db.js";
import { getWalletActivity, presentWalletActivity, captureTransaction } from "../services/walletActivity.js";
import { WalletError, createUserWallet, listUserWallets, renameUserWallet, resolveUserWallet, setDefaultUserWallet } from "../services/userWallets.js";

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
/**
 * @swagger
 * /api/wallet/networks:
 *   get:
 *     tags: [Wallet]
 *     summary: Networks the wallet can use (testnet / mainnet) and which are live
 */
router.get("/networks", authMiddleware, (_req, res) => {
  res.json({ success: true, networks: listNetworks() });
});

const sendWalletError = (res, error, fallback) => {
  if (error instanceof WalletError) {
    return res.status(error.status).json({ success: false, message: error.message, code: error.code });
  }
  return sendChainError(res, error, fallback);
};

const presentWallet = (w, balance = null) => ({
  id: w.address,
  name: w.label,
  address: w.address,
  index: w.index,
  isDefault: w.isDefault,
  balance: balance ?? 0,
  usdValue: 0,
  change24h: 0,
  isConnected: true,
  type: "aeko",
});

/**
 * @swagger
 * /api/wallet/list:
 *   get:
 *     tags: [Wallet]
 *     summary: The caller's custodial wallets
 *     security:
 *       - bearerAuth: []
 */
router.get("/list", authMiddleware, async (req, res) => {
  try {
    if (!isCustodyConfigured()) return custodyUnavailable(res);
    const wallets = await listUserWallets(req.user?.id || req.userId);
    res.json({ success: true, wallets: wallets.map((w) => presentWallet(w)) });
  } catch (error) {
    sendWalletError(res, error, "Failed to load wallets");
  }
});

/**
 * @swagger
 * /api/wallet/create:
 *   post:
 *     tags: [Wallet]
 *     summary: Create another custodial wallet (new address) for the caller
 *     security:
 *       - bearerAuth: []
 */
router.post("/create", authMiddleware, async (req, res) => {
  try {
    if (!isCustodyConfigured()) return custodyUnavailable(res);
    const wallet = await createUserWallet(req.user?.id || req.userId, req.body?.label);
    res.status(201).json({ success: true, wallet: presentWallet(wallet) });
  } catch (error) {
    sendWalletError(res, error, "Failed to create the wallet");
  }
});

/**
 * @swagger
 * /api/wallet/{address}:
 *   patch:
 *     tags: [Wallet]
 *     summary: Rename a wallet or make it the default
 *     security:
 *       - bearerAuth: []
 */
router.patch("/:address", authMiddleware, async (req, res) => {
  try {
    if (!isCustodyConfigured()) return custodyUnavailable(res);
    const userId = req.user?.id || req.userId;
    let wallet = null;
    if (typeof req.body?.label === "string") wallet = await renameUserWallet(userId, req.params.address, req.body.label);
    if (req.body?.isDefault === true) wallet = await setDefaultUserWallet(userId, req.params.address);
    if (!wallet) return res.status(400).json({ success: false, message: "Send a label or isDefault: true" });
    res.json({ success: true, wallet: presentWallet(wallet) });
  } catch (error) {
    sendWalletError(res, error, "Failed to update the wallet");
  }
});

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
    const connection = getConnection(resolveNetwork(req));
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
    const limit = Math.min(200, Number(req.query.limit) || 20);
    // Read from the validator; the Explorer helper this used did not exist.
    const network = resolveNetwork(req);
    const [activity, stakes] = await Promise.all([
      getWalletActivity(address, { limit, connection: getConnection(network), network }),
      getExplorer(network).listSocialStakes({ wallet: address }).catch(() => []),
    ]);
    res.json({
      success: true,
      transactions: await presentWalletActivity(activity),
      stakes: stakes ?? [],
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
    const nfts = await getExplorer(resolveNetwork(req)).listNfts({ owner: address });
    res.json({ success: true, nfts: await presentNfts(nfts) });
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
    const blockhash    = await getConnection(resolveNetwork(req)).getLatestBlockhash();
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

    const network = resolveNetwork(req);
    const connection = getConnection(network);
    const explorer = getExplorer(network);
    // Keeps User.walletAddress in step with wallet 0 for NFT/gift lookups.
    await resolveCustodialWallet(userId);
    const { wallet: current, wallets } = await resolveUserWallet(userId, req.query.wallet);
    const publicKey = current.address;

    // Balances for every wallet so the switcher can show them; an unfunded
    // address is unknown to the RPC until something lands on it.
    const balances = await Promise.all(
      wallets.map((w) => connection.getBalance(w.address).then(lamportsToAeko).catch(() => 0)),
    );
    const balance = balances[wallets.findIndex((w) => w.address === publicKey)] ?? 0;

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
      // No price oracle is wired up yet; usdValue stays 0 rather than an invented rate.
      wallets: wallets.map((w, i) => presentWallet(w, balances[i])),
      currentWalletId: publicKey,
      connectedWallets: [],
      stakingInfo,
      network,
      networkLabel: NETWORKS[network].label,
    });
  } catch (error) {
    console.error("wallet summary error:", error);
    sendWalletError(res, error, "Failed to load wallet");
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

    const { wallet: txWallet } = await resolveUserWallet(userId, req.query.wallet);
    const publicKey = txWallet.address;

    // The validator has no page cursor the app can hold, so read enough
    // signatures to cover the requested page and slice. Parsed transactions
    // are cached, so later pages don't re-read earlier ones.
    const network = resolveNetwork(req);
    const start = (page - 1) * limit;
    let activity = [];
    try {
      activity = await getWalletActivity(publicKey, { limit: start + limit + 1, connection: getConnection(network), network });
    } catch (error) {
      console.error("wallet transactions error:", error);
    }
    const transactions = await presentWalletActivity(activity.slice(start, start + limit));

    res.json({ transactions, page, hasMore: activity.length > start + limit });
  } catch (error) {
    console.error("wallet transactions error:", error);
    sendWalletError(res, error, "Failed to load transactions");
  }
});

/**
 * Shared implementation for transfer and withdraw. `feeAeko` is deducted from
 * the sender in addition to `amountAeko` and is retained by the platform's
 * service account.
 */
async function performCustodialTransfer({ userId, toAddress, amountAeko, feeAeko = 0, network = "testnet", fromWallet }) {
  const connection = getConnection(network);
  if (!isValidAddress(toAddress)) {
    return { status: 400, body: { success: false, message: "Invalid destination address" } };
  }

  const amount = Number(amountAeko);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { status: 400, body: { success: false, message: "Amount must be greater than 0" } };
  }

  await resolveCustodialWallet(userId);
  const { signer } = await resolveUserWallet(userId, fromWallet);

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
  // Both sides see it in "Recent activity" even after the ledger prunes it.
  void captureTransaction(signature, [signer.publicKey, toAddress], { connection, network });

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
    const { toAddress, amountAeko, fromWallet } = req.body || {};

    const { status, body } = await performCustodialTransfer({
      network: resolveNetwork(req),
      userId,
      toAddress,
      amountAeko,
      fromWallet,
    });
    res.status(status).json(body);
  } catch (error) {
    console.error("wallet transfer error:", error);
    sendWalletError(res, error, "Transfer failed");
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
    const { toAddress, amountAeko, fromWallet } = req.body || {};

    const { status, body } = await performCustodialTransfer({
      network: resolveNetwork(req),
      userId,
      toAddress,
      amountAeko,
      fromWallet,
      feeAeko: WITHDRAWAL_FEE_AEKO,
    });
    res.status(status).json(body);
  } catch (error) {
    console.error("wallet withdraw error:", error);
    sendWalletError(res, error, "Withdrawal failed");
  }
});

/**
 * @swagger
 * /api/wallet/airdrop:
 *   post:
 *     tags: [Wallet]
 *     summary: Request test AEKO for the caller's custodial wallet (testnet)
 *     description: |
 *       Forwards to the chain admin faucet (chain.aeko.online), which owns the
 *       policy: amount per request, cooldown per wallet and a daily budget.
 *       The backend authenticates with AEKO_FAUCET_API_KEY so its shared IP is
 *       not throttled; the per-wallet cooldown still applies.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Grant submitted
 *       429:
 *         description: Cooldown or daily budget reached (retryAfterSeconds when known)
 *       503:
 *         description: Faucet paused or not configured
 */
const FAUCET_API_URL = (process.env.AEKO_FAUCET_API_URL || "").replace(/\/+$/, "");
const FAUCET_API_KEY = process.env.AEKO_FAUCET_API_KEY || "";

// Direct-RPC fallback, used while the chain admin faucet (chain.aeko.online)
// is not configured: the validator forwards `requestAirdrop` to its testnet
// faucet. Policy is enforced here instead — one grant per wallet per cooldown,
// kept in memory, so it resets on restart (fine for a testnet; the admin
// faucet keeps a durable ledger once it is in place).
const DIRECT_AIRDROP_AEKO = Number(process.env.AEKO_TESTNET_AIRDROP_AEKO) || 5;
const DIRECT_AIRDROP_COOLDOWN_MS = (Number(process.env.AEKO_TESTNET_AIRDROP_COOLDOWN_HOURS) || 24) * 3_600_000;
const DIRECT_AIRDROP_ENABLED = process.env.AEKO_TESTNET_AIRDROP_DISABLED !== "1";
const lastDirectAirdropAt = new Map();

const formatWait = (ms) => {
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.ceil(seconds / 60)} min`;
  return `${Math.ceil(seconds / 3600)} h`;
};

async function directAirdrop(res, publicKey, network) {
  const connection = getConnection(network);
  if (!DIRECT_AIRDROP_ENABLED || !NETWORKS[network]?.faucet) {
    return res.status(503).json({
      success: false,
      message: "Test tokens aren't available right now.",
      code: "FAUCET_NOT_CONFIGURED",
    });
  }
  const last = lastDirectAirdropAt.get(publicKey) ?? 0;
  const wait = last + DIRECT_AIRDROP_COOLDOWN_MS - Date.now();
  if (wait > 0) {
    return res.status(429).json({
      success: false,
      message: `This wallet already received test AEKO. Try again in ${formatWait(wait)}.`,
      code: "COOLDOWN",
      retryAfterSeconds: Math.ceil(wait / 1000),
    });
  }
  lastDirectAirdropAt.set(publicKey, Date.now());
  let signature;
  try {
    signature = await connection.rpc("requestAirdrop", [publicKey, aekoToLamports(DIRECT_AIRDROP_AEKO)]);
  } catch (error) {
    lastDirectAirdropAt.delete(publicKey);
    throw error;
  }
  // Wait briefly so the balance is usually updated by the time the app refreshes.
  let confirmed = false;
  for (let attempt = 0; attempt < 12 && !confirmed; attempt += 1) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      const status = await connection.rpc("getSignatureStatuses", [[signature]]);
      const s = status?.value?.[0];
      if (s?.err) break;
      confirmed = s?.confirmationStatus === "confirmed" || s?.confirmationStatus === "finalized";
    } catch {
      // keep polling
    }
  }
  if (confirmed) void captureTransaction(signature, [publicKey], { connection, network });
  return res.json({
    success: true,
    address: publicKey,
    amount: DIRECT_AIRDROP_AEKO,
    signature,
    confirmed,
    explorerUrl: `${(process.env.AEKO_SCAN_URL || "https://scan.aeko.online").replace(/\/+$/, "")}/explorer/account/${publicKey}`,
  });
}

router.post("/airdrop", authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    if (!isCustodyConfigured()) return custodyUnavailable(res);

    const network = resolveNetwork(req);
    if (!NETWORKS[network]?.faucet) {
      return res.status(400).json({
        success: false,
        message: "There's no faucet on mainnet. Switch to Testnet for free test AEKO.",
        code: "NO_FAUCET",
      });
    }
    await resolveCustodialWallet(userId);
    const { wallet: dropWallet } = await resolveUserWallet(userId, req.body?.wallet ?? req.query.wallet);
    const publicKey = dropWallet.address;

    if (!FAUCET_API_URL) {
      return await directAirdrop(res, publicKey, network);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    let upstream;
    try {
      upstream = await fetch(`${FAUCET_API_URL}/api/faucet/request`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(FAUCET_API_KEY ? { "x-faucet-key": FAUCET_API_KEY } : {}),
        },
        body: JSON.stringify({ address: publicKey }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    const payload = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      const error = payload?.error ?? {};
      // The faucet's own codes and messages are written for end users; pass them
      // through so the app can show why, and when to try again.
      return res.status(upstream.status === 429 || upstream.status === 503 ? upstream.status : 400).json({
        success: false,
        message: error.message || "The faucet declined the request.",
        code: error.code || "FAUCET_DECLINED",
        ...(typeof error.retryAfterSeconds === "number" ? { retryAfterSeconds: error.retryAfterSeconds } : {}),
      });
    }

    const grant = payload?.data ?? {};
    if (grant.signature) {
      // The faucet confirms before answering; one read now keeps the airdrop in history.
      void captureTransaction(grant.signature, [publicKey], { connection: getConnection(network), network });
    }
    res.json({
      success: true,
      address: publicKey,
      amount: grant.amountAeko,
      signature: grant.signature,
      confirmed: Boolean(grant.confirmed),
      explorerUrl: grant.explorerUrl,
    });
  } catch (error) {
    console.error("wallet airdrop error:", error);
    if (error?.name === "AbortError") {
      return res.status(503).json({ success: false, message: "The faucet took too long to respond. Try again.", code: "FAUCET_TIMEOUT" });
    }
    sendWalletError(res, error, "Could not request test tokens");
  }
});

export default router;
