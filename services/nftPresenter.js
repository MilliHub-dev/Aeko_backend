import { prisma } from "../config/db.js";
import { explorer } from "../chain/client.js";

/**
 * One response shape for every NFT endpoint.
 *
 * `/api/nfts`, `/api/nfts/:tokenId`, `/api/wallet/:address/nfts` and
 * `/api/marketplace/listings` each returned whatever their source produced:
 * raw indexer objects (creator as a bare address, name and image nested under
 * `metadata`, images as `ipfs://` URIs no client can load) or decoded listing
 * accounts that carry a price but no name or image at all. The app cast those
 * to a hand-written type, so the marketplace rendered nothing and the detail
 * screen crashed on fields that never existed.
 *
 * Everything is read defensively: the indexer's field names are documented
 * only by example, and a missing field must degrade to a placeholder rather
 * than fail the whole list.
 */

const IPFS_GATEWAY = `${(process.env.IPFS_GATEWAY_URL || "https://gateway.pinata.cloud/ipfs").replace(/\/+$/, "")}/`;
const SCAN_URL = (process.env.AEKO_SCAN_URL || "https://scan.aeko.online").replace(/\/+$/, "");

const isObj = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v) => {
  if (typeof v === "string") return v.length > 0 ? v : null;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
};
const num = (v) => {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
};
const first = (...values) => values.find((v) => v !== undefined && v !== null && v !== "");

const CID = /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|bafy[a-z2-7]{20,})/;

/** Turns `ipfs://<cid>` (what the upload service stores) into a loadable URL. */
export function resolveIpfs(uri) {
  const value = str(uri);
  if (!value) return null;
  if (value.startsWith("ipfs://")) return `${IPFS_GATEWAY}${value.slice(7).replace(/^ipfs\//, "")}`;
  if (/^https?:\/\//i.test(value)) return value;
  if (CID.test(value)) return `${IPFS_GATEWAY}${value}`;
  return null;
}

const shortAddress = (address) =>
  address && address.length > 9 ? `${address.slice(0, 4)}…${address.slice(-4)}` : address || "";

const addressOf = (v) => (isObj(v) ? str(first(v.address, v.publicKey)) : str(v));

function normalize(raw) {
  if (!isObj(raw)) return null;
  const meta = isObj(raw.metadata) ? raw.metadata : {};

  const tokenId = str(first(raw.tokenId, raw.mint));
  const tokenAccount = str(first(raw.tokenAccount, raw.account));
  const id = str(first(raw.id, tokenId, tokenAccount, raw.address));
  if (!id) return null;

  const attrSource = first(raw.attributes, meta.attributes);
  const attributes = Array.isArray(attrSource)
    ? attrSource.filter(isObj).map((a) => ({ trait_type: str(a.trait_type) ?? undefined, value: a.value }))
    : [];
  const postId = str(attributes.find((a) => a.trait_type === "postId")?.value);

  return {
    id,
    tokenId,
    tokenAccount,
    name: str(first(raw.name, meta.name)) ?? "Untitled NFT",
    description: str(first(raw.description, meta.description)) ?? "",
    image: resolveIpfs(first(raw.image, meta.imageUri, meta.image, raw.imageUri)),
    collection: addressOf(first(raw.collection, raw.collectionAccount)),
    royaltyBps: num(first(raw.royaltyBps, meta.royaltyBps)) ?? 0,
    attributes,
    postId,
    creatorAddress: addressOf(first(raw.creator, raw.creatorAddress, meta.creator)),
    ownerAddress: addressOf(first(raw.owner, raw.ownerAddress)),
  };
}

/** Resolves wallet addresses to Aeko users in a single query. */
async function usersByAddress(addresses) {
  const unique = [...new Set(addresses.filter(Boolean))];
  if (unique.length === 0) return new Map();
  try {
    const users = await prisma.user.findMany({
      where: { walletAddress: { in: unique } },
      select: {
        id: true, name: true, username: true, profilePicture: true, walletAddress: true,
        blueTick: true, goldenTick: true, prideTick: true, businessTick: true,
      },
    });
    return new Map(users.map((u) => [u.walletAddress, u]));
  } catch (error) {
    // A profile lookup failing must not hide the NFTs; they fall back to addresses.
    console.error("nft presenter: user lookup failed:", error);
    return new Map();
  }
}

function party(address, users) {
  if (!address) return null;
  const user = users.get(address);
  return {
    address,
    id: user?.id ?? null,
    name: user?.name || user?.username || shortAddress(address),
    username: user?.username ?? null,
    avatar: user?.profilePicture ?? null,
    blueTick: Boolean(user?.blueTick),
    goldenTick: Boolean(user?.goldenTick),
    prideTick: Boolean(user?.prideTick),
    businessTick: Boolean(user?.businessTick),
  };
}

/**
 * @param {unknown[]} raws    explorer NFT objects
 * @param {object[]}  extras  per-item overrides: { price, listingId, ownerAddress }
 */
export async function presentNfts(raws, extras = []) {
  const items = [];
  const itemExtras = [];
  (Array.isArray(raws) ? raws : []).forEach((raw, index) => {
    const n = normalize(raw);
    if (!n) return;
    items.push(n);
    itemExtras.push(extras[index] || {});
  });

  const users = await usersByAddress(
    items.flatMap((n, i) => [n.creatorAddress, itemExtras[i].ownerAddress ?? n.ownerAddress]),
  );

  return items.map((n, i) => {
    const extra = itemExtras[i];
    const { creatorAddress, ownerAddress, ...rest } = n;
    const price = num(extra.price);
    const listingId = str(extra.listingId);
    return {
      ...rest,
      creator: party(creatorAddress, users),
      owner: party(str(extra.ownerAddress) ?? ownerAddress, users),
      price,
      listingId,
      isListed: Boolean(listingId) && price !== null,
      explorerUrl: rest.tokenId ? `${SCAN_URL}/explorer/nft/${encodeURIComponent(rest.tokenId)}` : null,
    };
  });
}

export async function presentNft(raw) {
  if (!raw) return null;
  const [nft] = await presentNfts([raw]);
  return nft ?? null;
}

/**
 * Listings are decoded straight from marketplace accounts, which store a price
 * and addresses but no name or image. Metadata is joined from the indexer on a
 * best-effort basis — an indexer that is down or has not caught up must not
 * hide listings that exist on-chain, so those render with a placeholder.
 */
export async function presentListings(listings) {
  const list = Array.isArray(listings) ? listings : [];
  const metadata = await Promise.allSettled(
    list.map((l) => (l.tokenAccount ? explorer.getNft(l.tokenAccount) : Promise.resolve(null))),
  );

  const raws = list.map((l, i) => {
    const found = metadata[i].status === "fulfilled" && isObj(metadata[i].value) ? metadata[i].value : {};
    return {
      ...found,
      tokenAccount: found.tokenAccount ?? l.tokenAccount,
      collection: found.collection ?? l.collection,
      creator: found.creator ?? l.creator,
      royaltyBps: found.royaltyBps ?? l.royaltyBps,
    };
  });
  const extras = list.map((l) => ({ listingId: l.listingId, price: l.priceAeko, ownerAddress: l.seller }));

  return presentNfts(raws, extras);
}
