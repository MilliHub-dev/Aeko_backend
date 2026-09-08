import { AekoConnection } from "@aeko-chain/web3.js";
import axios from "axios";

const RPC_URL      = process.env.AEKO_RPC_URL      ?? "http://localhost:8899";
const EXPLORER_URL = process.env.AEKO_EXPLORER_URL ?? "http://localhost:8088";


// The SDK derives its websocket endpoint by swapping http->ws on the RPC URL,
// which aims subscriptions at the RPC host rather than the dedicated websocket
// node. Nothing subscribes today, so this is configuration rather than a fix —
// but the derived default is wrong, and silently so.
const WS_URL = process.env.AEKO_WS_URL ?? RPC_URL.replace(/^http/i, "ws");

/**
 * How long a chain call may take before we give up.
 *
 * Neither the explorer client nor the SDK set one. When the RPC node or the
 * explorer is down — which happens — requests hung until the socket eventually
 * gave up, holding server connections open for minutes and leaving the app
 * spinning with no error.
 */
const CHAIN_TIMEOUT_MS = Number(process.env.AEKO_CHAIN_TIMEOUT_MS) || 10_000;

/** Marks an error as "the chain could not be reached", for a 503 rather than a 500. */
export class ChainUnavailableError extends Error {
  constructor(cause) {
    super("The Aeko chain is not reachable right now.");
    this.name = "ChainUnavailableError";
    this.cause = cause;
  }
}

// Socket-level failures: the host could not be reached at all.
const UNREACHABLE = /ECONNREFUSED|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|ECONNRESET|ECONNABORTED|abort|fetch failed|socket hang up/i;

/**
 * The SDK reports a transport failure as `AekoRpcError("RPC request failed with
 * HTTP <status>")` and a genuine JSON-RPC error as
 * `AekoRpcError(message, code, data)`. Only the first has no `code`, which is
 * what separates "the node isn't there" from "the node rejected this call".
 *
 * This matters right now: with the node undeployed the host answers 404 to
 * every RPC POST. A JSON-RPC node signals real errors in the body with HTTP
 * 200, so any non-2xx from it is infrastructure, never the request.
 */
const isRpcTransportFailure = (error) =>
  error?.name === "AekoRpcError" &&
  error.code === undefined &&
  /RPC request failed with HTTP \d+/i.test(String(error.message));

/** True when an error means the node/explorer is down rather than the request being wrong. */
export function isChainUnavailable(error) {
  if (!error) return false;
  if (error instanceof ChainUnavailableError) return true;
  if (isRpcTransportFailure(error)) return true;

  const status = error.response?.status;
  if (status === 502 || status === 503 || status === 504) return true;

  return UNREACHABLE.test(`${error.code ?? ""} ${error.message ?? ""}`);
}

// The SDK calls `fetchImpl` for every RPC request; wrapping it is the only place
// a timeout can be applied without patching the library.
const fetchWithTimeout = async (url, init = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CHAIN_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    throw isChainUnavailable(err) ? new ChainUnavailableError(err) : err;
  } finally {
    clearTimeout(timer);
  }
};

export const connection = new AekoConnection(RPC_URL, {
  fetchImpl: fetchWithTimeout,
});
connection.websocketEndpoint = WS_URL;

/**
 * @param {string} path
 * @param {{ collection?: boolean }} [opts]
 *   `collection: true` for list endpoints. A list can never legitimately 404 —
 *   an empty result is `200 { data: [] }` — so a 404 there means the route is
 *   not deployed, i.e. the explorer is down. Treating it as "not found" made
 *   `/api/nfts` answer `200 { nfts: null }` during an outage: a success
 *   response, with null where a list belongs.
 */
async function explorerGet(path, { collection = false } = {}) {
  try {
    const res = await axios.get(`${EXPLORER_URL}${path}`, {
      timeout: CHAIN_TIMEOUT_MS,
    });
    const payload = res.data?.data !== undefined ? res.data.data : res.data;
    return collection && !Array.isArray(payload) ? [] : payload;
  } catch (err) {
    if (err.response?.status === 404 && !collection) return null;
    // A missing entity is `null`; an unreachable explorer is a different thing
    // and callers need to be able to tell them apart.
    throw isChainUnavailable(err) || err.response?.status === 404
      ? new ChainUnavailableError(err)
      : err;
  }
}

export const explorer = {
  async listNfts({ owner, collection, creator, limit = 25 } = {}) {
    const p = new URLSearchParams({ limit: String(limit) });
    if (owner)      p.set("owner", owner);
    if (collection) p.set("collection", collection);
    if (creator)    p.set("creator", creator);
    return explorerGet(`/nfts?${p}`, { collection: true });
  },
  async getNft(tokenId) {
    return explorerGet(`/nfts/${tokenId}`);
  },
  async getCollection(collectionId) {
    return explorerGet(`/collections/${collectionId}`);
  },
  async getPost(postId) {
    return explorerGet(`/posts/${postId}`);
  },
  async listSocialStakes({ wallet, limit = 50 } = {}) {
    const p = new URLSearchParams({ limit: String(limit) });
    if (wallet) p.set("wallet", wallet);
    return explorerGet(`/stakes?${p}`, { collection: true });
  },
  async getCreatorProfile(address) {
    return explorerGet(`/creators/${address}`);
  },
};

/**
 * Reports a failed chain call.
 *
 * An unreachable node is a temporary outage, not a bug in the request — it
 * deserves a 503 and a message that says so. Every one of these handlers
 * returned a flat 500 "Failed to ..." instead, which is indistinguishable from
 * a broken endpoint and gives the app nothing useful to show.
 */
export function sendChainError(res, error, fallbackMessage) {
  if (isChainUnavailable(error)) {
    return res.status(503).json({
      success: false,
      message: "The Aeko chain is temporarily unavailable. Please try again shortly.",
      code: "CHAIN_UNAVAILABLE",
    });
  }
  return res.status(500).json({ success: false, message: fallbackMessage });
}
