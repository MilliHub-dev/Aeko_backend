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

/* ------------------------------------------------------------- networks */

/**
 * The wallet can point at testnet or mainnet. Each network is a separate
 * chain with its own RPC/Explorer; the custodial keys are the same, so a
 * user's address is identical on both. AEKO_RPC_URL/AEKO_EXPLORER_URL stay
 * the default network (testnet today) for every non-wallet route.
 */
const trim = (v) => (v ? String(v).replace(/\/+$/, "") : null);

export const NETWORKS = {
  testnet: {
    id: "testnet",
    label: "Testnet",
    rpc: trim(process.env.AEKO_TESTNET_RPC_URL) ?? RPC_URL,
    ws: trim(process.env.AEKO_TESTNET_WS_URL) ?? WS_URL,
    explorer: trim(process.env.AEKO_TESTNET_EXPLORER_URL) ?? EXPLORER_URL,
    scan: trim(process.env.AEKO_TESTNET_SCAN_URL) ?? trim(process.env.AEKO_SCAN_URL) ?? "https://scan.aeko.online",
    faucet: true,
  },
  mainnet: {
    id: "mainnet",
    label: "Mainnet",
    rpc: trim(process.env.AEKO_MAINNET_RPC_URL),
    ws: trim(process.env.AEKO_MAINNET_WS_URL),
    explorer: trim(process.env.AEKO_MAINNET_EXPLORER_URL),
    scan: trim(process.env.AEKO_MAINNET_SCAN_URL),
    faucet: false,
  },
};

export const DEFAULT_NETWORK = NETWORKS[process.env.AEKO_DEFAULT_NETWORK] ? process.env.AEKO_DEFAULT_NETWORK : "testnet";

export const isNetworkAvailable = (id) => Boolean(NETWORKS[id]?.rpc);

/** What the app shows in its network switcher. */
export const listNetworks = () =>
  Object.values(NETWORKS).map((n) => ({
    id: n.id,
    label: n.label,
    available: Boolean(n.rpc),
    isDefault: n.id === DEFAULT_NETWORK,
    faucet: n.faucet && Boolean(n.rpc),
    scanUrl: n.scan,
  }));

export class NetworkUnavailableError extends Error {
  constructor(id) {
    super(id === "mainnet" ? "Mainnet isn't live yet. Switch back to Testnet." : `The ${id} network isn't available.`);
    this.name = "NetworkUnavailableError";
    this.network = id;
  }
}

/**
 * The network a request asked for: `?network=` or the `x-aeko-network`
 * header, else the default. Throws when it is not configured so handlers
 * answer 503 with a clear message instead of querying localhost.
 */
export function resolveNetwork(req) {
  const raw = String(req?.query?.network ?? req?.headers?.["x-aeko-network"] ?? DEFAULT_NETWORK).toLowerCase();
  const id = NETWORKS[raw] ? raw : DEFAULT_NETWORK;
  if (!isNetworkAvailable(id)) throw new NetworkUnavailableError(id);
  return id;
}

const connections = new Map([[DEFAULT_NETWORK, connection]]);

/** One AekoConnection per network, created lazily. */
export function getConnection(id = DEFAULT_NETWORK) {
  const net = NETWORKS[id];
  if (!net?.rpc) throw new NetworkUnavailableError(id);
  let conn = connections.get(id);
  if (!conn) {
    conn = new AekoConnection(net.rpc, { fetchImpl: fetchWithTimeout });
    conn.websocketEndpoint = net.ws ?? net.rpc.replace(/^http/i, "ws");
    connections.set(id, conn);
  }
  return conn;
}

/**
 * @param {string} path
 * @param {{ collection?: boolean }} [opts]
 *   `collection: true` for list endpoints. A list can never legitimately 404 —
 *   an empty result is `200 { data: [] }` — so a 404 there means the route is
 *   not deployed, i.e. the explorer is down. Treating it as "not found" made
 *   `/api/nfts` answer `200 { nfts: null }` during an outage: a success
 *   response, with null where a list belongs.
 */
async function explorerGet(path, { collection = false, baseUrl = EXPLORER_URL } = {}) {
  try {
    const res = await axios.get(`${baseUrl}${path}`, {
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

const makeExplorer = (baseUrl) => ({
  async listNfts({ owner, collection, creator, limit = 25 } = {}) {
    const p = new URLSearchParams({ limit: String(limit) });
    if (owner)      p.set("owner", owner);
    if (collection) p.set("collection", collection);
    if (creator)    p.set("creator", creator);
    return explorerGet(`/nfts?${p}`, { collection: true, baseUrl });
  },
  async getNft(tokenId) {
    return explorerGet(`/nfts/${tokenId}`, { baseUrl });
  },
  async getCollection(collectionId) {
    return explorerGet(`/collections/${collectionId}`, { baseUrl });
  },
  async getPost(postId) {
    return explorerGet(`/posts/${postId}`, { baseUrl });
  },
  async listSocialStakes({ wallet, limit = 50 } = {}) {
    const p = new URLSearchParams({ limit: String(limit) });
    if (wallet) p.set("wallet", wallet);
    return explorerGet(`/stakes?${p}`, { collection: true, baseUrl });
  },
  async getCreatorProfile(address) {
    return explorerGet(`/creators/${address}`, { baseUrl });
  },
});

export const explorer = makeExplorer(EXPLORER_URL);

const explorers = new Map([[DEFAULT_NETWORK, explorer]]);

/** Explorer client for a network; falls back to RPC-only use when it has none. */
export function getExplorer(id = DEFAULT_NETWORK) {
  const net = NETWORKS[id];
  if (!net?.rpc) throw new NetworkUnavailableError(id);
  let ex = explorers.get(id);
  if (!ex) {
    ex = net.explorer ? makeExplorer(net.explorer) : makeExplorer(`${net.rpc}/__no_explorer__`);
    explorers.set(id, ex);
  }
  return ex;
}

/**
 * Reports a failed chain call.
 *
 * An unreachable node is a temporary outage, not a bug in the request — it
 * deserves a 503 and a message that says so. Every one of these handlers
 * returned a flat 500 "Failed to ..." instead, which is indistinguishable from
 * a broken endpoint and gives the app nothing useful to show.
 */
export function sendChainError(res, error, fallbackMessage) {
  if (error instanceof NetworkUnavailableError) {
    return res.status(503).json({ success: false, message: error.message, code: "NETWORK_UNAVAILABLE", network: error.network });
  }
  if (isChainUnavailable(error)) {
    return res.status(503).json({
      success: false,
      message: "The Aeko chain is temporarily unavailable. Please try again shortly.",
      code: "CHAIN_UNAVAILABLE",
    });
  }
  return res.status(500).json({ success: false, message: fallbackMessage });
}
