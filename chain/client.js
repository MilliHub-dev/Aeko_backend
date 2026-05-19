import { AekoConnection } from "@aeko-chain/web3.js";
import axios from "axios";

const RPC_URL      = process.env.AEKO_RPC_URL      ?? "http://localhost:8899";
const EXPLORER_URL = process.env.AEKO_EXPLORER_URL ?? "http://localhost:8088";

export const connection = new AekoConnection(RPC_URL);

async function explorerGet(path) {
  try {
    const res = await axios.get(`${EXPLORER_URL}${path}`);
    // API wraps responses: { data: <payload>, meta: {...} }
    return res.data?.data !== undefined ? res.data.data : res.data;
  } catch (err) {
    if (err.response?.status === 404) return null;
    throw err;
  }
}

export const explorer = {
  async listNfts({ owner, collection, creator, limit = 25 } = {}) {
    const p = new URLSearchParams({ limit: String(limit) });
    if (owner)      p.set("owner", owner);
    if (collection) p.set("collection", collection);
    if (creator)    p.set("creator", creator);
    return explorerGet(`/nfts?${p}`);
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
    return explorerGet(`/stakes?${p}`);
  },
  async getCreatorProfile(address) {
    return explorerGet(`/creators/${address}`);
  },
};
