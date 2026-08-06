# Clean NestJS Branch Migration Design

## Goal

Create a dedicated NestJS migration branch whose final runtime contains no legacy Express application code while preserving every supported backend feature, public contract, persistence effect, realtime event, provider interaction, security rule, and operational behavior users depend on.

The migration must be externally invisible except for explicitly approved security corrections. Repository evidence and executable parity tests determine completeness; confidence, route names, Swagger text, and directory presence do not.

## Branch And Worktree Model

`main` remains the authoritative Express reference throughout migration. It is not rewritten or stripped during parity work.

A separate Git worktree uses a dedicated branch named `migration/nestjs-clean`. The migration branch retains shared assets that are not Express runtime code:

- Prisma schema and reviewed migration history;
- database and seed assets required by both runtimes;
- provider protocol fixtures and generated types where valid;
- deployment, observability, and operational scripts that remain applicable;
- contract tests, parity fixtures, migration evidence, and documentation.

The final branch removes Express application runtime files, Express-only middleware, legacy route implementations, legacy Socket.IO implementations, duplicated scheduled jobs, and AdminJS Express integration only after their replacements pass the relevant gates.

The legacy worktree and deployment remain available as reference and rollback targets. The two runtimes must never process the same production write route, webhook, scheduled job, or event consumer simultaneously.

## Target Architecture

The target is an in-place NestJS modular monolith under `src/**`.

Each migrated domain owns a complete vertical slice:

- controllers or gateways defining transport contracts;
- Zod schemas at untyped HTTP, event, environment, and provider boundaries;
- application services containing orchestration and authorization;
- focused Prisma access and typed infrastructure adapters;
- explicit error translation and response serialization;
- unit, integration, contract, authorization, privacy, replay, and failure tests proportional to risk.

Shared modules are created only when two or more completed slices genuinely need them. The migration does not introduce microservices, a second ORM, speculative queues, empty modules, or a second repository layout.

## Toolchain

- Node.js 24 LTS is the supported development, CI, and deployment runtime.
- pnpm is the only package manager and `pnpm-lock.yaml` is committed.
- NestJS 11 uses the Express adapter unless a later approved compatibility requirement demands otherwise.
- TypeScript uses NodeNext modules and strict mode with additional checks such as `noUncheckedIndexedAccess`, `noImplicitOverride`, and `useUnknownInCatchVariables`.
- Zod validates untyped boundaries.
- Prisma/PostgreSQL remains the sole persistence layer.
- Biome owns formatting and linting.
- Vitest and Supertest provide unit, integration, and HTTP contract coverage.
- Socket.IO compatibility tests exercise the existing client-visible event protocol.
- The quality gate covers dependency reproducibility, Prisma validation, type checking, linting, tests, and production build.

## Completeness Inventory

Before claiming migration progress, the orchestrator creates a machine-checkable inventory from `main` covering:

- every Express method and route path;
- middleware order, authentication, authorization, blocking, privacy, rate limiting, parsing, uploads, and response filtering;
- every Socket.IO namespace, room rule, inbound event, outbound event, acknowledgement, and disconnect behavior;
- every scheduled job, trigger, lock/idempotency rule, database effect, and provider effect;
- AdminJS resources, actions, authentication, exports, and operational workflows;
- Prisma models, raw queries, transactions, concurrency assumptions, and numeric representations;
- payment providers, webhooks, signature verification, reconciliation, retry, and replay behavior;
- media, email, OAuth, notification, AI, Cloudinary, Pinata, and IPFS integrations;
- AEKO RPC, explorer, wallet, NFT, marketplace, reward, staking, transaction construction, confirmation, and reconciliation behavior;
- health, startup, configuration, logging, shutdown, CORS, proxy, body-size, and deployment behavior.

Every inventory item has an owner, risk level, legacy evidence link, target Nest module, parity cases, migration status, reviewer verdict, cutover state, and rollback state. An unclassified item blocks final completion.

## Migration Sequence

The orchestrator follows the repository role workflow for every bounded capability:

1. planner defines a small executable slice and acceptance criteria;
2. legacy Express engineer records executable behavior evidence;
3. reviewer confirms defects to correct rather than copy;
4. NestJS engineer implements the complete slice test-first;
5. blockchain engineer participates for AEKO or on-chain behavior;
6. equivalent cases run against both runtimes;
7. route/event/job ownership and rollback evidence are recorded;
8. reviewer returns Pass before the slice is considered complete.

Recommended dependency order:

1. pnpm, Node 24, configuration, logging, Prisma, health, error handling, test harnesses, and deployment routing;
2. public low-risk routes such as waitlist and read-only metadata;
3. authentication, sessions/OAuth, users, profiles, privacy, blocking, interests, security, notifications, reports, and support;
4. posts, comments, status, debates, challenges, spaces, communities, uploads, and content visibility;
5. chat, enhanced chat, livestream, video calls, bots, and Socket.IO behavior;
6. subscriptions, plans, payments, community payments, provider webhooks, coins, and reconciliation;
7. AdminJS resources, admin authentication/2FA, exports, and operational actions;
8. wallets, NFTs, marketplace, rewards, staking, and all AEKO-sensitive flows;
9. remaining jobs, operational cleanup, final legacy removal, and production cutover.

The exact sequence may change when repository dependencies require it, but high-risk payment and blockchain slices cannot bypass their specialist and reviewer gates.

## Parity Strategy

Parity is black-box and effect-aware. A shared case definition runs against the legacy service from the `main` worktree and the Nest service from the migration worktree.

Tests compare:

- status codes, headers, cookies, JSON fields, serialization, pagination, and error envelopes;
- input normalization, validation, upload limits, CORS, proxy handling, and rate limits;
- authentication, authorization, role checks, ownership, blocking, privacy, and negative cases;
- database rows, transactions, uniqueness races, idempotency, timestamps, and rollback effects;
- Socket.IO events, acknowledgements, rooms, ordering, reconnect behavior, and authorization;
- scheduled job effects and proof that only one runtime owns each side effect;
- provider requests through typed fakes or sandboxes, webhook signature checks, retry, reconciliation, and replay protection;
- exact money and chain values without unsafe JavaScript `number` conversion;
- chain submission, confirmation, indexing, ownership transfer, and database reconciliation.

Approved security corrections preserve the stable contract where possible and are documented individually. Known secret disclosure, missing authorization, replay, privacy, asset-loss, and premature-success defects are never copied for parity.

## Data And Schema Compatibility

Both runtimes use the same PostgreSQL schema during migration, but only one production runtime owns each write or side effect.

Schema changes require deployable Prisma migrations, forward/backward compatibility analysis, and rollback evidence. High-risk transitions use expand-and-contract sequencing when necessary. Existing data is validated with representative fixtures and production-safe audits before cutover.

The branch does not replace Prisma, rename tables for aesthetic reasons, or create duplicate storage. Admin and reporting consumers must continue to observe compatible data until their own migrations are complete.

## Deployment And Cutover

The migration environment can run legacy and Nest services simultaneously for comparison, but production routing assigns exactly one owner per route family, webhook, socket capability, and job.

Each cutover records:

- the exact gateway or deployment routing change;
- the previous and new owner;
- health and readiness prerequisites;
- database/provider/chain monitoring signals;
- rollback command and decision threshold;
- evidence that the previous owner stopped before the new owner accepted writes.

Final production replacement happens only when the completeness inventory has no unresolved capabilities, every high-risk gate passes, and the reviewer issues a release Pass. The legacy deployment remains recoverable for the agreed stabilization period.

## Final Legacy Removal

Express runtime removal is a late, separately reviewed phase. It deletes legacy routes, middleware, sockets, jobs, AdminJS Express wiring, Express bootstrap code, and dependencies only after the inventory proves replacements exist and production ownership has moved.

Contract fixtures, migration records, and tests may retain references to legacy behavior where they provide durable compatibility evidence. Shared Prisma and operational assets remain when the Nest runtime still uses them.

The final scan must prove there are no active Express imports, route mounts, listeners, duplicate jobs, or legacy runtime entry points in the clean branch.

## Completion Criteria

The clean migration is complete only when:

- the inventory covers every legacy capability and contains no unknown or unreviewed item;
- Node 24 and pnpm installation are reproducible from a clean checkout;
- strict TypeScript, Biome, Prisma validation, tests, and production build pass;
- all contract, authorization, privacy, integration, provider, realtime, job, payment, and blockchain gates pass;
- schema and existing-data compatibility are proven;
- production routing shows one owner for every route/event/job;
- rollback is documented and exercised;
- Express runtime code and dependencies are absent from the final branch;
- the independent reviewer returns Pass.

Until all criteria pass, status is reported as partial migration rather than complete.
