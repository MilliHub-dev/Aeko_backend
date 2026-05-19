# Aeko Chain — Frontend Integration Guide

> **For:** Web (Next.js) and Mobile (React Native) frontend developers  
> **Backend base URL (dev):** `http://localhost:9876`  
> **Backend base URL (prod):** `https://api.aeko.online`

---

## Table of Contents

1. [Architecture & Golden Rule](#1-architecture--golden-rule)
2. [Setup — SDK & Dependencies](#2-setup--sdk--dependencies)
3. [Wallet Management](#3-wallet-management)
4. [Signing & Submitting Transactions](#4-signing--submitting-transactions)
5. [Wallet Endpoints](#5-wallet-endpoints)
6. [NFT Endpoints](#6-nft-endpoints)
7. [Post Anchoring & Verification](#7-post-anchoring--verification)
8. [Marketplace Endpoints](#8-marketplace-endpoints)
9. [Rewards Endpoints](#9-rewards-endpoints)
10. [Staking Endpoints](#10-staking-endpoints)
11. [Key Storage Reference](#11-key-storage-reference)
12. [Environment Variables](#12-environment-variables)

---

## 1. Architecture & Golden Rule

```
Frontend App
    │
    │  REST (JWT auth)
    ▼
Aeko Backend  ←── prepares unsigned transactions, reads chain data
    │
    ▼
Aeko Chain (RPC + Explorer)
```

| Step | Who does it |
|------|-------------|
| Read chain data (balance, NFTs, etc.) | Backend → returns to app |
| Build a transaction | Backend |
| **Sign a transaction** | **App — private key never leaves the device** |
| Submit a transaction | App submits directly to RPC |

**The backend never sees the user's private key. Ever.**

---

## 2. Setup — SDK & Dependencies

### Web (Next.js)

```bash
npm install @aeko-chain/sdk @aeko-chain/web3.js
```

### Mobile (React Native / Expo)

```bash
npm install @aeko-chain/sdk @aeko-chain/web3.js
npx expo install expo-secure-store
```

### Shared chain client (call once, reuse everywhere)

```ts
// lib/chainClient.ts
import { AekoConnection } from "@aeko-chain/sdk";

export const connection = new AekoConnection(
  process.env.NEXT_PUBLIC_AEKO_RPC_URL ?? "https://api.testnet.aeko.chain"
);
```

---

## 3. Wallet Management

The user's keypair lives **in memory only** while the app is open. It is stored encrypted at rest (by PIN or device biometrics) and never sent to the server.

### Create a new wallet

```ts
import { AekoKeypair } from "@aeko-chain/sdk";
import { saveWallet } from "@/lib/walletStorage";

const mnemonic = AekoKeypair.generateMnemonic(); // 12-word phrase
const keypair  = AekoKeypair.fromMnemonic(mnemonic);

await saveWallet(keypair.secretKey, pin);
showMnemonicScreen(mnemonic); // user MUST write this down — unrecoverable if lost
```

### Import an existing wallet

```ts
const keypair = AekoKeypair.fromMnemonic(userEnteredMnemonic);
await saveWallet(keypair.secretKey, pin);
```

### Load wallet on app open

```ts
const secretKey = await loadWallet(pin); // throws if wrong PIN
const keypair   = AekoKeypair.fromSecretKey(secretKey);
// Store in WalletContext — wipe from memory on logout, never persist in plaintext
```

### WalletContext (React)

```tsx
// context/WalletContext.tsx
import { createContext, useContext, useState } from "react";
import { AekoKeypair } from "@aeko-chain/sdk";

interface WalletContextType {
  keypair: AekoKeypair | null;
  publicKey: string | null;
  unlock: (pin: string) => Promise<void>;
  lock: () => void;
}

const WalletContext = createContext<WalletContextType>(null!);

export function WalletProvider({ children }) {
  const [keypair, setKeypair] = useState<AekoKeypair | null>(null);

  async function unlock(pin: string) {
    const secretKey = await loadWallet(pin);
    setKeypair(AekoKeypair.fromSecretKey(secretKey));
  }

  function lock() {
    setKeypair(null); // wipe from memory
  }

  return (
    <WalletContext.Provider value={{ keypair, publicKey: keypair?.publicKey ?? null, unlock, lock }}>
      {children}
    </WalletContext.Provider>
  );
}

export const useWallet = () => useContext(WalletContext);
```

---

## 4. Signing & Submitting Transactions

Every "prepare" endpoint returns a `txBase64` — a base64-encoded **unsigned** transaction message. The app signs it and submits it to the RPC.

### Sign with one key (most endpoints)

```ts
import { Transaction, Message } from "@aeko-chain/web3.js";
import { AekoKeypair } from "@aeko-chain/sdk";

export function signTransaction(txBase64: string, keypair: AekoKeypair): string {
  const message   = Buffer.from(txBase64, "base64");
  const signature = keypair.sign(message);
  const tx = Transaction.populate(
    Message.from(message),
    [Buffer.from(signature).toString("base64")]
  );
  return tx.serialize().toString("base64");
}
```

### Sign with multiple keys (NFT minting — user key + token account key)

```ts
export function signTransactionMulti(txBase64: string, keypairs: AekoKeypair[]): string {
  const message    = Buffer.from(txBase64, "base64");
  const signatures = keypairs.map((kp) => Buffer.from(kp.sign(message)).toString("base64"));
  const tx = Transaction.populate(Message.from(message), signatures);
  return tx.serialize().toString("base64");
}
```

### Submit to RPC

```ts
import { connection } from "@/lib/chainClient";

const signature = await connection.sendRawTransaction(signedTxBase64);
await connection.confirmTransaction(signature);
```

---

## 5. Wallet Endpoints

### Link wallet to account

**`POST /api/wallet/link`** — requires JWT

Call this **once** after the user creates or imports their wallet. Stores the public wallet address in the backend DB — required before any marketplace, staking, or rewards claim endpoints will work.

> Only the public address is sent. The private key never leaves the device.

```ts
async function linkWallet(publicKey: string) {
  await fetch(`${BACKEND}/api/wallet/link`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ walletAddress: publicKey }),
  });
}
```

**Call this right after wallet creation or import:**
```ts
// After creating a new wallet
const mnemonic = AekoKeypair.generateMnemonic();
const keypair  = AekoKeypair.fromMnemonic(mnemonic);
await saveWallet(keypair.secretKey, pin);
await linkWallet(keypair.publicKey); // ← link to backend account

// After importing an existing wallet
const keypair = AekoKeypair.fromMnemonic(userEnteredMnemonic);
await saveWallet(keypair.secretKey, pin);
await linkWallet(keypair.publicKey); // ← link to backend account
```

**Response:**
```json
{ "success": true, "walletAddress": "AeKo1234...pubkey" }
```

**Unlink:** `DELETE /api/wallet/link` (no body needed) — removes the wallet from the account.

---

### Get balance

**`GET /api/wallet/:address/balance`**

No auth required.

```ts
const res  = await fetch(`${BACKEND}/api/wallet/${publicKey}/balance`);
const data = await res.json();
// data.aeko     → number (e.g. 5.25)
// data.lamports → integer
```

**Response:**
```json
{
  "success": true,
  "address": "AeKo1234...",
  "lamports": 5250000000,
  "aeko": 5.25
}
```

---

### Get transaction history

**`GET /api/wallet/:address/history?limit=20`**

No auth required.

```ts
const res  = await fetch(`${BACKEND}/api/wallet/${publicKey}/history?limit=20`);
const data = await res.json();
// data.transactions → recent txs
// data.posts        → posts created on-chain
// data.stakes       → stake positions
// data.rewards      → reward records
```

**Response:**
```json
{
  "success": true,
  "transactions": [...],
  "posts": [...],
  "stakes": [...],
  "rewards": [...]
}
```

---

### Get wallet NFTs

**`GET /api/wallet/:address/nfts`**

No auth required.

```ts
const res  = await fetch(`${BACKEND}/api/wallet/${publicKey}/nfts`);
const data = await res.json();
// data.nfts → array of NFT objects
```

---

### Send AEKO

**`POST /api/wallet/prepare-transfer`** — requires JWT

**Payload:**
```json
{
  "from": "AeKo1234...sender",
  "to": "AeKo5678...recipient",
  "amountAeko": 10.5
}
```

**Full flow:**
```ts
async function sendAeko(to: string, amountAeko: number) {
  const { keypair, publicKey } = useWallet();

  // 1. Backend prepares the unsigned tx
  const res = await fetch(`${BACKEND}/api/wallet/prepare-transfer`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ from: publicKey, to, amountAeko }),
  });
  const { txBase64 } = await res.json();

  // 2. Sign on device
  const signedTx = signTransaction(txBase64, keypair);

  // 3. Submit to RPC
  const signature = await connection.sendRawTransaction(signedTx);
  await connection.confirmTransaction(signature);
  return signature;
}
```

---

## 6. NFT Endpoints

### List NFTs

**`GET /api/nfts?owner=&collection=&creator=&limit=25`**

No auth required.

```ts
const params = new URLSearchParams({ owner: publicKey, limit: "25" });
const res    = await fetch(`${BACKEND}/api/nfts?${params}`);
const data   = await res.json();
// data.nfts → array
```

---

### Get single NFT

**`GET /api/nfts/:tokenId`**

```ts
const res  = await fetch(`${BACKEND}/api/nfts/${tokenId}`);
const data = await res.json();
// data.nft → NFT object
```

---

### Get collection

**`GET /api/nfts/collections/:collectionId`**

```ts
const res  = await fetch(`${BACKEND}/api/nfts/collections/${collectionId}`);
const data = await res.json();
// data.collection → collection object
```

---

### Upload NFT image & metadata to IPFS

**`POST /api/nfts/upload-metadata`** — requires JWT

Call this **before** `prepare-mint`. Uploads the image and metadata JSON to IPFS and returns the URIs needed by the mint transaction.

**Request:** `multipart/form-data`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `image` | file | Yes | JPEG, PNG, GIF, or WebP — max 50 MB |
| `name` | string | Yes | NFT display name |
| `description` | string | No | |
| `attributes` | string | No | JSON-stringified array of `{ trait_type, value }` |

```ts
async function uploadNftToIpfs(imageFile: File, name: string, description?: string) {
  const form = new FormData();
  form.append("image", imageFile);
  form.append("name", name);
  if (description) form.append("description", description);
  form.append("attributes", JSON.stringify([{ trait_type: "Rarity", value: "Rare" }]));

  const res = await fetch(`${BACKEND}/api/nfts/upload-metadata`, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}` },
    // Do NOT set Content-Type manually — the browser sets it with the boundary
    body: form,
  });
  const { uri, imageUri } = await res.json();
  // Pass uri and imageUri directly to prepare-mint
  return { uri, imageUri };
}
```

**Response:**
```json
{
  "success": true,
  "uri": "ipfs://QmMeta...",
  "imageUri": "ipfs://QmImage..."
}
```

---

### Mint an NFT

**`POST /api/nfts/prepare-mint`** — requires JWT

> Always call `upload-metadata` first to get `uri` and `imageUri`, then pass them here.

**Payload:**
```json
{
  "creator": "AeKo1234...creator",
  "collectionAccount": "AeKoCollect...",
  "royaltyBps": 500,
  "metadata": {
    "name": "My NFT #1",
    "uri": "ipfs://QmMeta...",
    "imageUri": "ipfs://QmImage...",
    "attributes": [
      { "trait_type": "Rarity", "value": "Rare" }
    ]
  }
}
```

> `royaltyBps` — basis points. 500 = 5% royalty on secondary sales.

**Full flow (requires two signatures — user + token account):**
```ts
async function mintNft(collectionAccount: string, imageFile: File, name: string, description?: string) {
  const { keypair, publicKey } = useWallet();

  // 1. Upload image + metadata to IPFS
  const { uri, imageUri } = await uploadNftToIpfs(imageFile, name, description);

  // 2. Backend prepares the tx and generates the token account
  const res = await fetch(`${BACKEND}/api/nfts/prepare-mint`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({
      creator: publicKey,
      collectionAccount,
      royaltyBps: 500,
      metadata: { name, uri, imageUri },
    }),
  });
  const { txBase64, tokenAccount, tokenAccountSecretKey } = await res.json();

  // 3. Sign with BOTH keys — user's key + the new token account key
  const tokenKeypair = AekoKeypair.fromSecretKey(new Uint8Array(tokenAccountSecretKey));
  const signedTx     = signTransactionMulti(txBase64, [keypair, tokenKeypair]);

  // 4. Submit
  const signature = await connection.sendRawTransaction(signedTx);
  await connection.confirmTransaction(signature);
  return { signature, tokenAccount };
}
```

**Response:**
```json
{
  "success": true,
  "txBase64": "...",
  "tokenAccount": "AeKoToken...",
  "tokenAccountSecretKey": [1, 2, 3, ...]
}
```

---

### Transfer an NFT

**`POST /api/nfts/prepare-transfer`** — requires JWT

**Payload:**
```json
{
  "collectionAccount": "AeKoCollect...",
  "tokenAccount": "AeKoToken...",
  "currentOwner": "AeKo1234...owner",
  "newOwner": "AeKo5678...newowner"
}
```

**Flow:** same as send AEKO — one signer (current owner).

```ts
const { txBase64 } = await api.post("/nfts/prepare-transfer", payload);
const signedTx = signTransaction(txBase64, keypair);
await connection.sendRawTransaction(signedTx);
```

---

## 7. Post Anchoring & Verification

### Anchor a post on-chain

**`POST /api/posts/:postId/anchor`** — requires JWT

Call this immediately after creating a post. The backend computes the content hash and submits the on-chain anchor using the service keypair — no signing needed from the frontend.

**Payload:**
```json
{
  "creatorAddress": "AeKo1234...creator",
  "contentUri": "ipfs://QmPost..."
}
```

> `contentUri` is **optional**. If omitted, the backend automatically uploads the post content to IPFS and uses that URI. Pass it only if you have already uploaded to IPFS yourself.

```ts
async function anchorPost(postId: string, creatorAddress: string, contentUri?: string) {
  const res = await fetch(`${BACKEND}/api/posts/${postId}/anchor`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ creatorAddress, ...(contentUri ? { contentUri } : {}) }),
  });
  const data = await res.json();
  // data.signature   → on-chain tx signature
  // data.anchored    → true
  // data.contentUri  → the IPFS URI used (useful if backend auto-uploaded)
  return data;
}
```

**Response:**
```json
{
  "success": true,
  "signature": "5Kj8Tx...",
  "anchored": true,
  "contentUri": "ipfs://QmPost..."
}
```

---

### Verify a post

**`GET /api/posts/:postId/verify`**

No auth required. Use this to show a "verified" badge.

```ts
const res  = await fetch(`${BACKEND}/api/posts/${postId}/verify`);
const data = await res.json();

if (data.verified) {
  showVerifiedBadge({ signature: data.onChainSignature, creator: data.creator });
} else {
  // data.reason → "not anchored" | "not found on chain"
}
```

**Response (verified):**
```json
{
  "success": true,
  "verified": true,
  "postId": "abc123",
  "contentUri": "https://cdn.aeko.social/posts/abc123",
  "creator": "AeKo1234...creator",
  "createdAtUnix": 1715000000,
  "onChainSignature": "5Kj8Tx..."
}
```

**Response (not anchored):**
```json
{
  "success": true,
  "verified": false,
  "reason": "not anchored"
}
```

---

### Mint a post as an NFT

**`POST /api/posts/:postId/mint-as-nft`** — requires JWT

Turns any post into a Token-721 NFT. The backend uploads the post content to IPFS (or reuses the existing `contentUri` if the post was already anchored) and builds the unsigned mint transaction.

**Payload:**
```json
{
  "collectionAccount": "AeKoCollect...",
  "creatorAddress": "AeKo1234...creator",
  "royaltyBps": 500
}
```

> `royaltyBps` is optional (defaults to 0).

**Full flow (requires two signatures — same as regular NFT mint):**
```ts
async function mintPostAsNft(postId: string, collectionAccount: string, royaltyBps = 0) {
  const { keypair, publicKey } = useWallet();

  // 1. Backend uploads post content to IPFS and builds the tx
  const res = await fetch(`${BACKEND}/api/posts/${postId}/mint-as-nft`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ collectionAccount, creatorAddress: publicKey, royaltyBps }),
  });
  const { txBase64, tokenAccount, tokenAccountSecretKey, contentUri } = await res.json();

  // 2. Sign with BOTH keys — user's key + the new token account key
  const tokenKeypair = AekoKeypair.fromSecretKey(new Uint8Array(tokenAccountSecretKey));
  const signedTx     = signTransactionMulti(txBase64, [keypair, tokenKeypair]);

  // 3. Submit
  const signature = await connection.sendRawTransaction(signedTx);
  await connection.confirmTransaction(signature);

  return { signature, tokenAccount, contentUri };
}
```

**Response:**
```json
{
  "success": true,
  "txBase64": "...",
  "tokenAccount": "AeKoToken...",
  "tokenAccountSecretKey": [1, 2, 3, ...],
  "contentUri": "ipfs://QmPost..."
}
```

> Save the `tokenAccount` — it's the NFT's on-chain identity, needed for transfers and marketplace listings.

---

## 8. Marketplace Endpoints

### Get listings

**`GET /api/marketplace/listings?seller=&collection=&minPrice=&maxPrice=&limit=25`**

No auth required.

```ts
const params = new URLSearchParams({ limit: "25" });
const res    = await fetch(`${BACKEND}/api/marketplace/listings?${params}`);
const data   = await res.json();
// data.listings → array of active listings, each includes listingId
```

**Listing object:**
```json
{
  "listingId": "AeKoListing...",
  "seller": "AeKo1234...",
  "collection": "AeKoCollect...",
  "tokenAccount": "AeKoToken...",
  "priceAeko": 50,
  "royaltyBps": 500,
  "state": "Active"
}
```

---

### List an NFT for sale

**`POST /api/marketplace/prepare-list`** — requires JWT + `walletAddress` on account

**Payload:**
```json
{
  "collectionAccount": "AeKoCollect...",
  "tokenAccount": "AeKoToken...",
  "creatorAddress": "AeKo1234...creator",
  "priceAeko": 50,
  "royaltyBps": 500,
  "expiresInDays": 30
}
```

> `creatorAddress` — the original NFT creator (for royalty routing on-chain). Required.  
> `royaltyBps` and `expiresInDays` are optional. Omit `expiresInDays` for no expiry.

**Full flow:**
```ts
async function listNftForSale(
  collectionAccount: string, tokenAccount: string,
  creatorAddress: string, priceAeko: number, royaltyBps = 0
) {
  const { keypair } = useWallet();

  // 1. Backend builds the tx (CreateAccountWithSeed + ListNft in one tx)
  const res = await fetch(`${BACKEND}/api/marketplace/prepare-list`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ collectionAccount, tokenAccount, creatorAddress, priceAeko, royaltyBps, expiresInDays: 30 }),
  });
  const { txBase64, listingAccount } = await res.json();

  // 2. Seller is the only signer
  const signedTx = signTransaction(txBase64, keypair);

  // 3. Submit
  const signature = await connection.sendRawTransaction(signedTx);
  await connection.confirmTransaction(signature);
  return { signature, listingAccount };
}
```

**Response:**
```json
{
  "success": true,
  "txBase64": "...",
  "listingAccount": "AeKoListing..."
}
```

---

### Buy an NFT

**`POST /api/marketplace/prepare-buy`** — requires JWT + `walletAddress` on account

**Payload:**
```json
{
  "listingId": "AeKoListing..."
}
```

**Full flow:**
```ts
async function buyNft(listingId: string) {
  const { keypair } = useWallet();

  // 1. Backend builds the atomic 4-instruction tx + price breakdown
  const res = await fetch(`${BACKEND}/api/marketplace/prepare-buy`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ listingId }),
  });
  const { txBase64, breakdown } = await res.json();

  // 2. Show the price breakdown to user before they sign
  const confirmed = await showConfirmModal({
    price:       `${breakdown.price} AEKO`,
    royalty:     `${breakdown.royalty} AEKO → creator`,
    platformFee: `${breakdown.platformFee} AEKO → AEKO Treasury`,
    sellerGets:  `${breakdown.sellerGets} AEKO → seller`,
    total:       `${breakdown.price} AEKO`,
  });
  if (!confirmed) return;

  // 3. Buyer is the only signer — the tx atomically handles all payments + token transfer
  const signedTx  = signTransaction(txBase64, keypair);
  const signature = await connection.sendRawTransaction(signedTx);
  await connection.confirmTransaction(signature);
  return signature;
}
```

**Response:**
```json
{
  "success": true,
  "txBase64": "...",
  "breakdown": {
    "price": 50,
    "royalty": 2.5,
    "platformFee": 1.0,
    "sellerGets": 46.5
  }
}
```

> **Important:** The buy transaction is atomic — it simultaneously transfers payments (to seller, creator, treasury) and ownership of the token. If the listing is no longer Active when the tx reaches the chain, the entire transaction rolls back.

---

### Cancel a listing

**`POST /api/marketplace/prepare-cancel`** — requires JWT + must be the seller

**Payload:**
```json
{
  "listingId": "AeKoListing..."
}
```

```ts
const { txBase64 } = await api.post("/marketplace/prepare-cancel", { listingId });
const signedTx = signTransaction(txBase64, keypair);
await connection.sendRawTransaction(signedTx);
```

---

## 9. Rewards Endpoints

### Get claimable rewards

**`GET /api/rewards/:address`**

No auth required.

```ts
const res  = await fetch(`${BACKEND}/api/rewards/${publicKey}`);
const data = await res.json();
// data.totalClaimable → AEKO available now (number)
// data.totalEarned    → lifetime AEKO earned
// data.recentEpochs   → per-epoch breakdown array
```

**Response:**
```json
{
  "success": true,
  "address": "AeKo1234...",
  "totalEarned": 1500.0,
  "totalClaimable": 240.5,
  "recentEpochs": [
    { "epoch": 182, "amountAeko": 80.5, "status": "Claimable" },
    { "epoch": 181, "amountAeko": 60.0, "status": "Claimed" }
  ]
}
```

---

### Claim rewards

**`POST /api/rewards/prepare-claim`** — requires JWT + `walletAddress` on account

**Payload:**
```json
{
  "amount": 100
}
```

> `amount` is in AEKO (not lamports). Must not exceed `totalClaimable`.

**Full flow:**
```ts
async function claimRewards(amountAeko: number) {
  const { keypair } = useWallet();

  const res = await fetch(`${BACKEND}/api/rewards/prepare-claim`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ amount: amountAeko }),
  });
  const { txBase64 } = await res.json();

  const signedTx  = signTransaction(txBase64, keypair);
  const signature = await connection.sendRawTransaction(signedTx);
  await connection.confirmTransaction(signature);

  showToast(`${amountAeko} AEKO claimed!`);
  refreshBalance();
}
```

**Response:**
```json
{
  "success": true,
  "txBase64": "...",
  "amountAeko": 100,
  "amountLamports": 100000000000
}
```

---

## 10. Staking Endpoints

### Rewards settle automatically every 24 hours via a backend cron job — no frontend action needed.

### Get stake positions

**`GET /api/staking/:address/positions`**

No auth required.

```ts
const res  = await fetch(`${BACKEND}/api/staking/${publicKey}/positions`);
const data = await res.json();
// data.positions   → array of stake positions
// data.totalStaked → total AEKO staked across active positions
```

**Position object:**
```json
{
  "positionId": "a1b2c3d4...",
  "creator": "AeKo1234...creator",
  "stakedAmount": 300,
  "state": "Active",
  "accumulatedYield": 12.4,
  "claimedYield": 4.2,
  "claimableYield": 8.2,
  "unlockEpoch": null
}
```

> `state` can be `"Active"`, `"CoolingDown"`, or `"Closed"`.  
> `unlockEpoch` is set when state is `"CoolingDown"`.

---

### Stake AEKO on a creator

**`POST /api/staking/prepare-open`** — requires JWT + `walletAddress` on account

**Payload:**
```json
{
  "creatorAddress": "AeKo1234...creator",
  "amountAeko": 100
}
```

```ts
async function stakeOnCreator(creatorAddress: string, amountAeko: number) {
  const { keypair } = useWallet();

  const res = await fetch(`${BACKEND}/api/staking/prepare-open`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ creatorAddress, amountAeko }),
  });
  const { txBase64, positionId } = await res.json();

  const signedTx  = signTransaction(txBase64, keypair);
  const signature = await connection.sendRawTransaction(signedTx);
  await connection.confirmTransaction(signature);

  showToast(`Staked ${amountAeko} AEKO!`);
  return positionId; // store this — needed to claim yield or unstake
}
```

**Response:**
```json
{
  "success": true,
  "txBase64": "...",
  "positionId": "a1b2c3d4e5f6..."
}
```

> Save `positionId` — you need it for claim-yield, unstake, and finalize-unstake.

---

### Claim yield from a stake position

**`POST /api/staking/prepare-claim-yield`** — requires JWT + `walletAddress` on account

**Payload:**
```json
{
  "positionId": "a1b2c3d4..."
}
```

```ts
const { txBase64, claimableAeko } = await api.post("/staking/prepare-claim-yield", { positionId });
const signedTx = signTransaction(txBase64, keypair);
await connection.sendRawTransaction(signedTx);
showToast(`${claimableAeko} AEKO yield claimed!`);
```

**Response:**
```json
{
  "success": true,
  "txBase64": "...",
  "claimableAeko": 8.2
}
```

---

### Unstake (begin cooldown)

**`POST /api/staking/prepare-unstake`** — requires JWT + `walletAddress` on account

**Payload:**
```json
{
  "positionId": "a1b2c3d4..."
}
```

```ts
const { txBase64, unlockEpoch, cooldownDays } = await api.post("/staking/prepare-unstake", { positionId });
const signedTx = signTransaction(txBase64, keypair);
await connection.sendRawTransaction(signedTx);
showToast(`Unstaking in ${cooldownDays} days`);
// Update UI: show countdown to unlockEpoch
```

**Response:**
```json
{
  "success": true,
  "txBase64": "...",
  "unlockEpoch": 189,
  "cooldownDays": 7
}
```

---

### Finalize unstake (after cooldown)

**`POST /api/staking/prepare-finalize-unstake`** — requires JWT + `walletAddress` on account

Only callable after the cooldown period has passed. If called too early, the backend returns a 400 with `epochsRemaining`.

**Payload:**
```json
{
  "positionId": "a1b2c3d4..."
}
```

```ts
async function finalizeUnstake(positionId: string) {
  const res = await fetch(`${BACKEND}/api/staking/prepare-finalize-unstake`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ positionId }),
  });

  if (res.status === 400) {
    const err = await res.json();
    // err.epochsRemaining → how many epochs left before unlock
    showToast(`Still cooling down — ${err.epochsRemaining} epochs remaining`);
    return;
  }

  const { txBase64 } = await res.json();
  const signedTx  = signTransaction(txBase64, keypair);
  const signature = await connection.sendRawTransaction(signedTx);
  await connection.confirmTransaction(signature);
  showToast("AEKO returned to your wallet!");
  refreshBalance();
}
```

**Response:**
```json
{
  "success": true,
  "txBase64": "..."
}
```

**Error (cooldown not complete):**
```json
{
  "success": false,
  "message": "Cooldown not complete",
  "currentEpoch": 185,
  "unlockEpoch": 189,
  "epochsRemaining": 4
}
```

---

## 11. Key Storage Reference

### Web (Next.js) — AES-GCM encrypted in localStorage

```ts
// lib/walletStorage.ts
const STORAGE_KEY = "aeko_encrypted_wallet";

export async function saveWallet(secretKey: Uint8Array, pin: string): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv   = crypto.getRandomValues(new Uint8Array(12));
  const keyMaterial = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveKey"]
  );
  const aesKey = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" },
    keyMaterial, { name: "AES-GCM", length: 256 }, false, ["encrypt"]
  );
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aesKey, secretKey);
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    salt: Array.from(salt),
    iv:   Array.from(iv),
    data: Array.from(new Uint8Array(ciphertext)),
  }));
}

export async function loadWallet(pin: string): Promise<Uint8Array> {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) throw new Error("No wallet found");
  const { salt, iv, data } = JSON.parse(stored);
  const keyMaterial = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveKey"]
  );
  const aesKey = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: new Uint8Array(salt), iterations: 100_000, hash: "SHA-256" },
    keyMaterial, { name: "AES-GCM", length: 256 }, false, ["decrypt"]
  );
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(iv) }, aesKey, new Uint8Array(data)
  );
  return new Uint8Array(decrypted);
}

export function hasWallet(): boolean {
  return !!localStorage.getItem(STORAGE_KEY);
}
```

### Mobile (React Native / Expo) — Keychain / Secure Enclave

```ts
// lib/walletStorage.ts (React Native)
import * as SecureStore from "expo-secure-store";

const OPTIONS = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

export async function saveWallet(secretKey: Uint8Array, pin: string): Promise<void> {
  // Use the same AES-GCM derivation as web, then store the ciphertext
  const encrypted = await encryptWithPin(secretKey, pin); // implement same as web above
  await SecureStore.setItemAsync("aeko_wallet", JSON.stringify(encrypted), OPTIONS);
}

export async function loadWallet(pin: string): Promise<Uint8Array> {
  const stored = await SecureStore.getItemAsync("aeko_wallet");
  if (!stored) throw new Error("No wallet found");
  return decryptWithPin(JSON.parse(stored), pin); // throws on wrong PIN
}

export async function hasWallet(): Promise<boolean> {
  return !!(await SecureStore.getItemAsync("aeko_wallet"));
}
```

---

## 12. Environment Variables

### Next.js (.env.local)

```env
NEXT_PUBLIC_BACKEND_URL=https://api.aeko.online
NEXT_PUBLIC_AEKO_RPC_URL=https://api.testnet.aeko.chain
```

### React Native / Expo (.env)

```env
EXPO_PUBLIC_BACKEND_URL=https://api.aeko.online
EXPO_PUBLIC_AEKO_RPC_URL=https://api.testnet.aeko.chain
```

---

## Quick Reference — All Endpoints

| Method | Path | Auth | Signers needed |
|--------|------|------|----------------|
| POST | `/api/wallet/link` | JWT | — |
| DELETE | `/api/wallet/link` | JWT | — |
| GET | `/api/wallet/:address/balance` | No | — |
| GET | `/api/wallet/:address/history` | No | — |
| GET | `/api/wallet/:address/nfts` | No | — |
| POST | `/api/wallet/prepare-transfer` | JWT | User |
| GET | `/api/nfts` | No | — |
| GET | `/api/nfts/collections/:id` | No | — |
| GET | `/api/nfts/:tokenId` | No | — |
| POST | `/api/nfts/upload-metadata` | JWT | None (call before prepare-mint) |
| POST | `/api/nfts/prepare-mint` | JWT | User + token account |
| POST | `/api/nfts/prepare-transfer` | JWT | Current owner |
| POST | `/api/posts/:postId/anchor` | JWT | None (service keypair signs) |
| POST | `/api/posts/:postId/mint-as-nft` | JWT | User + token account |
| GET | `/api/posts/:postId/verify` | No | — |
| GET | `/api/marketplace/listings` | No | — |
| POST | `/api/marketplace/prepare-list` | JWT | Seller |
| POST | `/api/marketplace/prepare-buy` | JWT | Buyer |
| POST | `/api/marketplace/prepare-cancel` | JWT | Seller |
| GET | `/api/rewards/:address` | No | — |
| POST | `/api/rewards/prepare-claim` | JWT | Creator |
| GET | `/api/staking/:address/positions` | No | — |
| POST | `/api/staking/prepare-open` | JWT | Staker |
| POST | `/api/staking/prepare-claim-yield` | JWT | Staker |
| POST | `/api/staking/prepare-unstake` | JWT | Staker |
| POST | `/api/staking/prepare-finalize-unstake` | JWT | Staker |

> All JWT-protected endpoints also require `walletAddress` to be set on the user's account (stored in the backend DB). Prompt users to link their wallet to their account if this field is missing.
