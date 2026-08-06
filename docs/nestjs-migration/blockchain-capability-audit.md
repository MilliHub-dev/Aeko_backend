# Blockchain-Sensitive Legacy Capability Audit

## Evidence Boundary

- Legacy runtime: `C:\Users\olaitan\Dev\aeko\backend` at commit `5dc327fddf37f1fe7a7d58a733a0548f72541f69`, with user-owned dirty state that the generated inventory must record verbatim.
- Target planning worktree: `C:\Users\olaitan\Dev\aeko\backend\.worktrees\nestjs-clean`.
- Evidence date: 2026-08-06.
- This is planning and migration evidence only. It does not validate AEKO protocol code or authorize changes to `aeko-chain`.
- RPC account state and transaction confirmation are authoritative. Explorer responses are eventual indexing evidence only. PostgreSQL is authoritative for application workflow and reconciliation status.

## Executive Finding

The mounted Express runtime exposes useful AEKO reads and unsigned transaction preparation, but it does not implement an end-to-end chain-operation lifecycle. No mounted route accepts a signed transaction, submits it, confirms it through RPC, persists confirmed slot/signature, expires stale preparations, or reconciles explorer indexing. Preparation responses must therefore remain `PREPARED`, never be inventoried as completed anchoring, minting, transfer, purchase, reward, or staking behavior.

The clean migration must model `PREPARED -> SUBMITTED -> CONFIRMING -> CONFIRMED`, with terminal `FAILED` and `EXPIRED`, plus a separate explorer reconciliation result. Each operation needs an idempotency key, authenticated user, verified linked wallet, operation type, exact decimal-string amounts, blockhash expiry, signature, confirmed slot, and sanitized failure reason.

## Shared Chain And Explorer Adapters

| Capability | Exact legacy evidence | State/value contract | Semantics and dependencies | Required parity and blockers |
| --- | --- | --- | --- | --- |
| RPC client | `chain/client.js:4-7` | `AEKO_RPC_URL`; default `http://localhost:8899` | Singleton `AekoConnection`; RPC is used for balances, blockhashes, rent, accounts and program accounts | Validate startup configuration; fixture RPC error, malformed account, timeout and stale blockhash cases |
| Explorer client | `chain/client.js:9-39` | `AEKO_EXPLORER_URL`; default `http://localhost:8088`; wrapper unwraps `{data}` and maps HTTP 404 to `null` | Implements NFT, collection, post, stake and creator reads | Explorer lag must not reverse RPC-confirmed state; schema/version and pagination response shapes are unknown |
| Broken explorer call | `routes/walletRoutes.js:147-166` versus `chain/client.js:20-39` | Calls `explorer.getAccountDetail(address)`, which is not defined | Mounted wallet-history route fails at runtime unless an undocumented mutation supplies this method | Inventory as supported route with known defect; parity must preserve envelope only after replacing source with a verified explorer/RPC contract |
| Exact conversion helpers | `chain/utils.js:6-7` | Converts lamports through JavaScript `number`; AEKO uses 1,000,000,000 lamports | `Math.floor(aeko * 1e9)` and division by `1e9` | Unsafe for `u64`, fractional parsing and values above safe integer range; target uses `bigint` internally and decimal strings at boundaries |
| Local transaction serializer | `chain/txBuilder.js:7-101` | U32/U64 little-endian, short-vec signatures/accounts/instructions, legacy message layout | Builds unsigned multi-instruction transactions and system transfer variant `2` | Block until golden fixtures verify header field ordering, account ordering, signer/writable classification, program index, short-vec encoding and system instruction bytes against chain code |
| Service keypair | `chain/serviceKeypair.js:4-31`; `chain/utils.js:31-37` | 64-byte JSON keypair; Ed25519 PKCS8 signing; fills first signer slot | Import throws at startup when used without secret; no mounted route imports it; helper can submit and confirm | Treat committed `.env.example` key bytes as compromised and require rotation. Do not migrate service signing without explicit operation authorization, least privilege and audit evidence |

## Wallet

Mounted at `/api/wallet` in `server.js:162` under the general API rate limit.

| Route | Evidence | Authority and side effects | Current lifecycle | Parity cases / unsafe defects |
| --- | --- | --- | --- | --- |
| `POST /link` | `routes/walletRoutes.js:51-75`; `prisma/schema.prisma:518` | Authenticated DB update of unique `User.walletAddress` | Database-only completed update | Missing base58 validation and proof-of-possession challenge/signature. Any authenticated user can bind an arbitrary unclaimed wallet. Test duplicate race, unauthorized request and invalid address |
| `DELETE /link` | `routes/walletRoutes.js:83-95` | Authenticated DB update to `null` | Database-only completed update | No check for pending chain operations/listings/stakes; target must define unlink policy before coverage |
| `GET /:address/balance` | `routes/walletRoutes.js:118-128` | Public RPC balance read | Read only | Lamports must serialize as decimal string, not unsafe number; invalid address and RPC failure cases |
| `GET /:address/history` | `routes/walletRoutes.js:147-166` | Intended explorer aggregate read | Broken read | Undefined explorer method is a release blocker, not behavior to copy |
| `GET /:address/nfts` | `routes/walletRoutes.js:180-189` | Public explorer indexed read | Read only | Explorer lag/404/shape cases; ownership must not be inferred for authorization from explorer alone |
| `POST /prepare-transfer` | `routes/walletRoutes.js:225-249` | Authenticated caller supplies `from`, `to`, and numeric `amountAeko`; RPC blockhash; local unsigned system transfer | PREPARED only | Does not require `from === req.user.walletAddress`, validate destination, positive exact amount, available balance, or expose expiry. Test unauthorized wallet, zero/negative/fractional/overflow amount, stale blockhash, replay, submit failure and confirmation failure |

## Post Anchoring, Verification, NFT Conversion And Transfer

Mounted post routes inherit rate limiting, blocking and response-privacy middleware at `server.js:128`.

| Capability | Evidence | Authority and side effects | Current lifecycle | Parity cases / unsafe defects |
| --- | --- | --- | --- | --- |
| Prepare post anchor | `routes/postRoutes.js:1246-1293` | Reads PostgreSQL post; may publish text/media metadata permanently to IPFS; caller supplies creator; SDK prepares anchor against `SOCIAL_POSTS_STATE_ACCOUNT`; DB writes `contentUri` | PREPARED only, but IPFS and DB side effects occur before submission | No check that authenticated user owns post, creator matches linked wallet, post visibility permits public IPFS, or state account is configured. Optimistic `contentUri` survives abandoned/failed tx. Require privacy/ownership, deterministic hash fixtures, expiry, replay and rollback/reconciliation cases |
| Verify post | `routes/postRoutes.js:1447-1474`; `prisma/schema.prisma:365-368` | DB `isAnchored` gates explorer lookup; explorer result presented as verification | Read/reconcile-like but explorer is incorrectly treated as chain truth | No code found that sets `isAnchored`, `onChainSignature`, or `nftTokenId` after confirmation. Explorer lookup uses raw DB post ID while prepare hashes it to base58. Block coverage until lookup key and confirmed DB transition are defined |
| Prepare post-as-NFT | `routes/postRoutes.js:1393-1445` | Reads post, may publish IPFS JSON, derives token account from caller address plus `Date.now()`, gets rent/blockhash, prepares mint | PREPARED only | Missing post ownership/visibility and linked-wallet checks; token ID collision/retry semantics are undefined; docs mention a token secret that response/implementation does not produce. Test deterministic account derivation fixture, retries, metadata visibility, royalty range and confirmation reconciliation |
| DB-only post transfer | `routes/postTransferRoutes.js:42-196` | PostgreSQL changes `Post.userId`, transfer history and ownership chain | Completed DB update, not on-chain | File is not imported/mounted by `server.js`; inventory as unmounted unknown, not public contract. If revived, define relation to anchored creator/NFT ownership and perform transactional concurrency control |

## NFTs

Mounted at `/api/nfts` in `server.js:163`.

| Capability | Evidence | Current semantics | Required parity and blockers |
| --- | --- | --- | --- |
| List/get collection/get NFT | `routes/nftRoutes.js:40-107` | Public explorer reads with optional filters and numeric limits | Validate limit bounds and explorer response schema; explorer ownership cannot authorize transfers |
| Upload metadata | `routes/nftRoutes.js:149-176` | Authenticated 50 MiB in-memory upload publishes image and JSON through Pinata/IPFS | Public disclosure is irreversible; MIME/content validation, ownership, visibility, JSON attribute validation and duplicate/retry behavior require tests |
| Prepare mint | `routes/nftRoutes.js:217-260` | Caller supplies creator/collection/metadata; token ID is `Date.now()`; rent and blockhash from RPC; deterministic seeded token account; unsigned SDK transaction | PREPARED only. Creator is not tied to linked wallet; collection authority/royalty bounds/metadata size are not verified; blockhash expiry omitted |
| Prepare NFT transfer | `routes/nftRoutes.js:281-304` | Caller supplies token/current/new owner; unsigned SDK transaction | PREPARED only. No RPC ownership lookup or link proof; test unauthorized owner, stale account, replay and confirmed ownership reconciliation |

## Marketplace

Mounted at `/api/marketplace` in `server.js:164`. All values are intended to be lamports but are decoded and calculated as JavaScript numbers.

| Capability | Evidence | Current semantics | Required parity and blockers |
| --- | --- | --- | --- |
| Decode/list/fetch listing | `routes/marketplaceRoutes.js:35-111` | RPC account/program reads; layout is 4 pubkeys, `u64` price, `u16` royalty, optional expiry, state byte | `readBigUInt64LE` is immediately converted to `Number`; expiry value is skipped and not returned. Block until account discriminator/owner/data length/layout and exact `u64` fixture are verified from chain code |
| Prepare listing | `routes/marketplaceRoutes.js:157-197` | Uses linked wallet as seller; derives seeded listing account; prepares SDK list transaction | PREPARED only. Does not prove current NFT ownership, collection/token relationship, exact positive price, royalty bounds or expiry-slot calculation. `2.5 slots/sec` is an undocumented estimate |
| Prepare purchase | `routes/marketplaceRoutes.js:252-302`; local BuyNft bytes at `20-32` | Builds atomic transfers to seller/creator/treasury plus a one-byte BuyNft instruction that marks listing sold | PREPARED only and asset-loss critical. The transaction contains no visible Token-721 ownership-transfer instruction. Atomic payment plus listing-state update is not atomic NFT delivery. Release must block until verified protocol semantics prove BuyNft transfers ownership or a verified transfer instruction is included |
| Fee allocation | `routes/marketplaceRoutes.js:267-286` | `royalty=floor(price*bps/10000)`, `platform=floor(price*feeBps/10000)`, seller receives remainder; default platform fee 200 bps | Use bigint math and prove `seller + royalty + platform == price`. Reject negative components and total bps above 10,000. Treasury and program IDs require configuration validation |
| Prepare cancellation | `routes/marketplaceRoutes.js:351-380` | RPC listing read, exact linked-wallet seller check, unsigned SDK cancellation | PREPARED only. Test stale sold/cancelled state, concurrent buy/cancel, replay and confirmed state reconciliation |

## Rewards, Epochs And Staking

| Capability | Evidence | Current semantics | Required parity and blockers |
| --- | --- | --- | --- |
| Reward summary | `routes/rewardsRoutes.js:44-70` | Public explorer creator profile converted to AEKO numbers; absent profile returns zeros | Explorer lag and exact `u64` response shape unknown; use decimal strings |
| Reward claim | `routes/rewardsRoutes.js:111-117` | Authenticated stable `501` placeholder | Preserve as unsupported until verified SDK/program support exists; do not claim preparation or settlement coverage |
| Stake positions | `routes/stakingRoutes.js:48-76` | Public explorer list; calculates claimable and total with JavaScript subtraction/sum | Potential precision loss and negative yield; explorer schema/state enum/epoch type unknown |
| Stake open/claim/unstake/finalize | `routes/stakingRoutes.js:113,148,184,233` | Authenticated stable `501` placeholders | Four distinct unsupported capabilities; programme must not count Swagger-described success flows as runtime behavior |
| Epoch settlement cron | `jobs/settleEpoch.js:1-7`, imported by `server.js:223` | Daily midnight cron logs a skip; no chain or DB effect | Operational ownership item only. Timezone, multi-instance lock, overlap and retry are unproven. Keep one owner and stable no-op until settlement is implemented through a separately reviewed chain plan |

## Coins, Transactions And Community Payment Crossovers

- `routes/coinRoutes.js` is fiat-provider and PostgreSQL behavior, not AEKO-chain behavior despite the product name “Aeko Coins.” It exposes six mounted routes under `/api/coins`: packages, balance, history, Paystack/Stripe purchase initialization, and two verification/credit paths.
- `CoinTransaction.amount`, `balanceAfter`, and `User.coinBalance` are `Float` (`prisma/schema.prisma:617-628` and user schema). Provider payment, balance update and idempotency are migration risks, but these values must not be mislabeled as chain lamports or AEKO balances.
- Both verification flows check JSON metadata for a reference before a read-then-write Prisma transaction. There is no database unique idempotency constraint, so concurrent replay can double-credit. Provider metadata is trusted for user/package association. These remain high-risk payment crossover cases for the payment specialist.
- Community payment routes are mounted at `/api/community/payment` (`server.js:178`) and are fiat-provider/database flows. `.env.example` advertises `aeko_wallet` and AEKO fee variables, but the mounted validation documents only Paystack/Stripe initialization and bank withdrawal. `services/communityPaymentService.js:293` mentions `aeko_wallet` only in documentation. Inventory AEKO community payment as stale/unimplemented configuration, not supported chain behavior.
- `Transaction.amount` is `Float` (`prisma/schema.prisma:442-460`). Migration requires Decimal/integer-minor-unit compatibility planning, provider confirmation/replay tests, and redacted provider payloads. It must remain separate from the chain-operation lifecycle.

## Required Typed Target Contracts

The blockchain infrastructure slice should expose separate operations rather than transport-coupled SDK calls:

```ts
type ChainQuantity = string; // canonical unsigned decimal integer

type PreparedChainOperation = {
  operationId: string;
  operationType: string;
  walletAddress: string;
  transactionBase64: string;
  recentBlockhash: string;
  expiresAtBlockHeight: ChainQuantity;
  exactAmounts: Record<string, ChainQuantity>;
};

type ConfirmedChainOperation = {
  operationId: string;
  signature: string;
  confirmedSlot: ChainQuantity;
  rpcStatus: "confirmed";
  explorerStatus: "pending" | "indexed" | "mismatch";
};
```

Required infrastructure boundaries are `RpcGateway`, `ExplorerGateway`, `TransactionSerializer`, `ChainOperationStore`, and operation-specific policy/services. Submission must accept only the transaction prepared for the same authenticated user, linked wallet, operation ID and unexpired blockhash. Confirmation must inspect RPC error/status and relevant post-state accounts before committing the application transition. Explorer reconciliation is asynchronous and cannot downgrade valid RPC confirmation solely because indexing lags.

## Machine-Checkable Inventory Guidance

The inventory generator and programme should emit at least these blockchain group identifiers:

- `blockchain.adapter.rpc`, `blockchain.adapter.explorer`, `blockchain.adapter.serializer`, `blockchain.adapter.service-signing`;
- `wallet.link`, `wallet.unlink`, `wallet.balance`, `wallet.history`, `wallet.nfts`, `wallet.transfer.prepare`;
- `post.anchor.prepare`, `post.anchor.verify`, `post.nft.prepare`, `post.transfer.unmounted`;
- `nft.list`, `nft.collection.read`, `nft.read`, `nft.metadata.publish`, `nft.mint.prepare`, `nft.transfer.prepare`;
- `marketplace.listings.read`, `marketplace.list.prepare`, `marketplace.buy.prepare`, `marketplace.cancel.prepare`;
- `rewards.summary`, `rewards.claim.unsupported`, `rewards.epoch-settlement.noop`;
- `staking.positions`, `staking.open.unsupported`, `staking.claim.unsupported`, `staking.unstake.unsupported`, `staking.finalize.unsupported`;
- `coins.fiat-crossover`, `transactions.fiat-crossover`, `community-payment.aeko-wallet.unimplemented`.

Every write/preparation item is `risk: high` and owned by the blockchain integration engineer with the relevant domain engineer. Unsupported, broken, unmounted, and stale-config items remain explicit and block “zero unknowns”; they must not be omitted or marked migrated based on route names.

## Mandatory Parity And Safety Cases

1. Golden instruction serialization and account decoding against verified program fixtures.
2. Invalid/mismatched linked wallet, resource owner, NFT owner, seller, buyer and creator authorization.
3. Exact minimum, maximum, fractional, zero, negative and overflow quantities without JavaScript-number conversion.
4. Stale/expired blockhash, duplicate preparation, replayed submission and duplicate confirmation callback.
5. RPC simulation/submission failure, confirmation error, timeout, fork/reorg policy and post-state mismatch.
6. Explorer 404, lag, malformed data and disagreement with confirmed RPC state.
7. IPFS failure, retry, duplicate publication and restricted-content rejection before public upload.
8. Concurrent marketplace buy/buy and buy/cancel with exact fee allocation and atomic NFT ownership transfer.
9. Process restart between each lifecycle state and reconciliation retry without duplicate asset movement.
10. Sanitized errors/logs that never expose keypair bytes, raw provider payloads or private content.

## Unknowns That Block Coverage

- Verified AEKO program IDs, account ownership/discriminators, instruction variants/account ordering and serialization fixtures from the chain protocol source.
- Whether marketplace `BuyNft` itself transfers Token-721 ownership; backend code alone indicates it only receives listing and buyer accounts.
- SDK blockhash return type and expiry/block-height semantics.
- RPC commitment/finality levels, confirmation response schema, simulation support and retry rules.
- Explorer endpoint schemas, pagination, numeric encoding, post lookup key and indexing-lag guarantees.
- Reward vault/state layouts, claim builder and epoch settlement rules.
- Stake position layout, cooldown epoch source, yield math and all staking builders.
- Collection authority, token-account ownership and metadata constraints for NFT mint/transfer.
- Product decision for DB post ownership after an anchored post or post-NFT changes hands.
- Whether any external client currently submits prepared transactions and calls an undocumented callback; black-box traffic/client evidence is required.
- Rotation status of the concrete service keypair committed in `.env.example`.

Until these are resolved with protocol/runtime evidence, the programme may plan the slices and preserve stable `501`/error contracts, but it must not claim full blockchain parity or production readiness.
