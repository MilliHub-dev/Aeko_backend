import { connection as defaultConnection } from "../chain/client.js";
import { prisma } from "../config/db.js";
import { lamportsToAeko } from "../chain/utils.js";

/**
 * A wallet's on-chain activity, straight from the validator.
 *
 * The wallet screen used to ask the Explorer for `recentTransactions`, through
 * a helper that was never written, so "Recent activity" was always empty. The
 * validator keeps full transaction history (`--enable-rpc-transaction-history`),
 * so this reads it directly: signatures for the address, then each
 * transaction parsed, and the wallet's own balance delta decides direction
 * and amount. Parsed transactions are cached by signature; they never change.
 */

const SYSTEM_PROGRAM = "11111111111111111111111111111111";
const MAX_SIGNATURES = 200;
const PARSE_CONCURRENCY = 6;
const CACHE_LIMIT = 2000;

/** @type {Map<string, object>} signature -> parsed activity entry */
const parsedCache = new Map();

/** The testnet faucet, so an airdrop is labelled rather than shown as a stranger's address. */
const FAUCET_PUBKEY = process.env.AEKO_FAUCET_PUBKEY || null;
// The genesis faucet holds the bulk of supply. Anything paying out of a
// balance that large is the faucet, whatever its address.
const FAUCET_BALANCE_FLOOR = 100_000_000 * 1_000_000_000;

const shortAddress = (address) => (address ? `${address.slice(0, 4)}…${address.slice(-4)}` : "");

function remember(signature, entry) {
  parsedCache.set(signature, entry);
  if (parsedCache.size > CACHE_LIMIT) {
    const oldest = parsedCache.keys().next().value;
    parsedCache.delete(oldest);
  }
}

/**
 * Reads one transaction and expresses it from `address`'s point of view.
 * Returns null for transactions that did not change this wallet's balance.
 */
async function parseForWallet(signature, address, meta, connection, cacheKey) {
  const cached = parsedCache.get(cacheKey);
  if (cached) return cached;

  const tx = await connection.rpc("getTransaction", [
    signature,
    { encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "confirmed" },
  ]);
  if (!tx) return null;

  const keys = (tx.transaction?.message?.accountKeys ?? []).map((k) => (typeof k === "string" ? k : k.pubkey));
  const index = keys.indexOf(address);
  if (index === -1) return null;

  const pre = Number(tx.meta?.preBalances?.[index] ?? 0);
  const post = Number(tx.meta?.postBalances?.[index] ?? 0);
  const fee = Number(tx.meta?.fee ?? 0);
  const feePayer = keys[0];
  const net = post - pre;
  if (net === 0) return null;

  // Prefer the parsed system transfer for the counterparty and amount; fall
  // back to the balance delta (minus the fee when this wallet paid it).
  const instructions = tx.transaction?.message?.instructions ?? [];
  const transfer = instructions.find(
    (ix) => ix.program === "system" && ix.parsed?.type === "transfer" && (ix.parsed.info?.source === address || ix.parsed.info?.destination === address),
  );
  const incoming = net > 0;
  let counterpart = null;
  let lamports;
  if (transfer) {
    counterpart = incoming ? transfer.parsed.info.source : transfer.parsed.info.destination;
    lamports = Number(transfer.parsed.info.lamports);
  } else {
    counterpart = keys.find((k, i) => i !== index && k !== SYSTEM_PROGRAM && tx.meta?.preBalances?.[i] !== tx.meta?.postBalances?.[i]) ?? null;
    lamports = Math.abs(net) - (feePayer === address && !incoming ? fee : 0);
  }

  const counterpartPre = counterpart ? Number(tx.meta?.preBalances?.[keys.indexOf(counterpart)] ?? 0) : 0;
  const isFaucet = incoming && Boolean(counterpart) && (counterpart === FAUCET_PUBKEY || counterpartPre >= FAUCET_BALANCE_FLOOR);

  const entry = {
    signature,
    slot: tx.slot ?? meta?.slot ?? null,
    blockTime: tx.blockTime ?? meta?.blockTime ?? null,
    success: !tx.meta?.err,
    incoming,
    lamports: Math.max(0, lamports),
    fee: feePayer === address ? fee : 0,
    counterpart,
    isFaucet,
  };
  remember(cacheKey, entry);
  return entry;
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

/**
 * @param {string} address
 * @param {{ limit?: number, connection?: object, network?: string }} [opts]  how many signatures to read (newest first), and which chain
 * @returns {Promise<Array>} activity entries, newest first, balance-changing only
 */
export async function getWalletActivity(address, { limit = 50, connection = defaultConnection, network = "default" } = {}) {
  const take = Math.min(MAX_SIGNATURES, Math.max(1, limit));
  const signatures = await connection.rpc("getSignaturesForAddress", [address, { limit: take, commitment: "confirmed" }]);
  if (!Array.isArray(signatures) || signatures.length === 0) return [];

  const entries = await mapLimit(signatures, PARSE_CONCURRENCY, async (sig) => {
    try {
      // Signatures are unique per chain; the cache key carries the network so
      // testnet and mainnet history can never bleed into each other.
      return await parseForWallet(sig.signature, address, sig, connection, `${network}:${sig.signature}`);
    } catch (error) {
      console.error(`wallet activity: could not parse ${sig.signature}:`, error?.message ?? error);
      return null;
    }
  });
  return entries.filter(Boolean);
}

/**
 * Turns activity entries into the wallet screen's transaction rows, naming
 * counterparties that are Aeko users by their username.
 */
export async function presentWalletActivity(entries) {
  const addresses = [...new Set(entries.map((e) => e.counterpart).filter(Boolean))];
  const users = addresses.length
    ? await prisma.user.findMany({ where: { walletAddress: { in: addresses } }, select: { walletAddress: true, username: true, profilePicture: true } })
    : [];
  const byAddress = new Map(users.map((u) => [u.walletAddress, u]));

  return entries.map((e) => {
    const user = e.counterpart ? byAddress.get(e.counterpart) : null;
    const who = e.isFaucet ? "Testnet faucet" : user?.username ? `@${user.username}` : shortAddress(e.counterpart);
    return {
      id: e.signature,
      type: e.incoming ? "received" : "sent",
      title: e.isFaucet ? "Test AEKO received" : e.incoming ? "Received" : "Sent",
      subtitle: e.incoming ? `From ${who}` : `To ${who}`,
      amount: lamportsToAeko(e.lamports),
      timestamp: e.blockTime ? new Date(e.blockTime * 1000).toISOString() : new Date().toISOString(),
      avatar: user?.profilePicture ?? undefined,
      isPositive: e.incoming,
      signature: e.signature,
      success: e.success,
    };
  });
}

export default { getWalletActivity, presentWalletActivity };
