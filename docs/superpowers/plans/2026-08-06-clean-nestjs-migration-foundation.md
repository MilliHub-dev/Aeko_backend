# Clean NestJS Migration Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the isolated clean NestJS migration worktree, freeze a verifiable Express baseline, inventory every backend capability, and establish the parity infrastructure required for safe domain-by-domain migration.

**Architecture:** `main` remains the legacy reference in the current worktree. A sibling worktree on `migration/nestjs-clean` contains the NestJS target, shared Prisma assets, migration evidence, and compatibility tests. The orchestrator assigns each inventory family to the appropriate role and permits implementation only after legacy handoff and reviewer acceptance criteria exist.

**Tech Stack:** Git worktrees, Node.js 24 LTS, pnpm 10.33.2, NestJS 11, TypeScript NodeNext strict mode, Zod, Prisma/PostgreSQL, Biome 2, Vitest, Supertest, Socket.IO client tests.

## Global Constraints

- Follow `.agents/roles/orchestrator.md`; the orchestrator coordinates and does not edit product source.
- Keep `main` as the authoritative Express reference and rollback source.
- Create the target branch as `migration/nestjs-clean` in an isolated sibling worktree.
- Preserve Prisma schema/migrations and compatible operational assets.
- Do not delete Express runtime code until the final inventory and reviewer gates pass.
- Never allow both runtimes to own the same production write, webhook, event consumer, or scheduled job.
- Use Node.js 24 LTS and pnpm with a committed lockfile.
- Report partial migration truthfully; an unknown inventory item blocks final completion.

## Reconciled Execution State (2026-08-06)

This plan is executed in the existing target worktree
`C:\Users\olaitan\Dev\aeko\backend\.worktrees\nestjs-clean` on branch
`migration/nestjs-clean`, currently based on commit
`5dc327fddf37f1fe7a7d58a733a0548f72541f69`. The reference Express worktree remains
`C:\Users\olaitan\Dev\aeko\backend` on `main` at the same commit, with user-owned dirty state.
Do not create the obsolete sibling path `C:\Users\olaitan\Dev\aeko\backend-nestjs-clean` and do not
discard, overwrite, or recommit unrelated partial work.

Current evidence and task state:

| Task | State | Evidence | Gate to completion |
| --- | --- | --- | --- |
| 1. Worktree/toolchain | In progress | Branch/worktree isolation exists; `.node-version`, TypeScript, Biome, Vitest and manifest edits exist | Generate and commit `pnpm-lock.yaml`; run install and quality checks under Node 24; current shell reports Node 25 and Corepack cache access is blocked |
| 2. Capability inventory | In progress | Extractor/test and legacy/blockchain handoffs exist | Resolve mount prefixes and middleware order; record commit/dirty state; classify sockets, jobs, AdminJS, Prisma/providers/operations; generate audited JSON and Markdown |
| 3. Parity infrastructure | In progress | Typed contracts, HTTP/socket runners, effect recorder, test and report schema exist | Run RED/GREEN evidence; add executable HTTP/socket fixtures, cookies/headers/effects/report-schema coverage, deterministic redaction and exact-value cases |
| 4. Nest operational foundation | Not started | No `src/**` foundation files or foundation tests exist | Complete configuration, logging, request ID, Prisma lifecycle, health/readiness, shutdown and quality gates without importing legacy runtime code |
| 5. Domain programme | Not started | No programme, domain manifests, coverage test or generated inventory exists | Inventory audit passes with zero unclassified items; every item is assigned exactly once; reviewer approves first slice and no-cutover state |

Tasks are strictly ordered by their gates: Task 1 enables executable checks; Task 2 supplies the
authoritative capability set; Task 3 supplies comparison infrastructure; Task 4 supplies a candidate
Nest runtime; Task 5 may be drafted earlier but cannot pass coverage until Tasks 2-4 pass. No route,
Socket.IO event, webhook, job, provider consumer, or AdminJS action changes production owner in Tasks
1-5.

## Foundation Acceptance Criteria

Tasks 1-5 are accepted only when all of the following are evidenced by commands actually run:

1. **Compatibility:** Express remains the sole current owner of every legacy capability. The
   inventory records method/path or event/job/action identifier, middleware/auth requirements,
   contract cases, candidate Nest module, and explicit `express-owner` cutover state.
2. **Security:** configuration fails closed; secrets, personal data and raw provider failures are
   redacted; negative auth/privacy/replay cases are assigned; known authorization, privacy,
   key-exposure, replay and asset-loss defects are corrected or explicitly blocked, never copied.
3. **Data:** Prisma/PostgreSQL remains the only persistence layer; schema changes are out of scope for
   foundation unless separately approved; parity cases record transactions, uniqueness/concurrency,
   idempotency and exact money/chain strings or bigint-safe values.
4. **Side effects:** each write, webhook, provider call, scheduled job, Socket.IO consumer and chain
   operation has exactly one production owner. Foundation tests use fakes/disposable data and do not
   call live payment, media, email, AI, RPC or explorer services.
5. **Operations:** invalid config blocks listening; liveness is process-only; readiness proves
   PostgreSQL connectivity; request IDs, sanitized structured logs, parser/CORS/proxy behavior and
   graceful shutdown have tests.
6. **Rollback:** Tasks 1-5 perform no production cutover. Rollback is removal of migration routing or
   stopping the candidate Nest deployment while the unchanged Express deployment remains available.
   Database/provider/chain rollback is `not-applicable` until a later slice owns a side effect.
7. **Review:** the independent reviewer returns Pass for isolation, reproducibility, inventory
   completeness, parity behavior, foundation quality, programme coverage and absence of premature
   legacy deletion. Any unclassified inventory item or unexercised required command is a Block.

---

### Task 1: Create The Clean Migration Worktree Safely

**Files:**
- Read: `.agents/doctrine/00-authority.md`
- Read: `.agents/doctrine/nestjs-migration.md`
- Read: `.agents/roles/orchestrator.md`
- Create in target worktree: `.node-version`
- Modify in target worktree: `package.json`
- Create in target worktree: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: the existing `main` reference worktree and existing partial migration worktree
- Produces: reproducible Node/pnpm manifests in the already isolated branch without moving or overwriting current changes

- [ ] **Step 1: Record the current source state**

Run: `git branch --show-current`

Run: `git rev-parse HEAD`

Run: `git status --short`

Expected: the current branch, baseline commit, and all user-owned uncommitted files are recorded before branch operations.

- [x] **Step 2: Verify the approved target worktree path**

Run: `git worktree list --porcelain`

Expected: `C:\Users\olaitan\Dev\aeko\backend\.worktrees\nestjs-clean` is attached to
`migration/nestjs-clean`, and the main worktree remains attached to `main`.

- [x] **Step 3: Confirm the branch baseline**

Run in both worktrees: `git rev-parse HEAD`

Expected: both report `5dc327fddf37f1fe7a7d58a733a0548f72541f69` before migration commits.

- [ ] **Step 4: Verify isolation**

Run in both worktrees: `git status --short`

Expected: the reference worktree retains its user-owned changes and the target reports only reviewed
migration artifacts. A dirty target is expected while Tasks 1-3 are in progress.

- [ ] **Step 5: Apply the approved toolchain baseline in the new worktree**

Declare Node `>=24 <25`, `.node-version` `24.18.1`, `packageManager` `pnpm@10.33.2`, strict TypeScript, Biome, Vitest, and pnpm quality scripts. Generate `pnpm-lock.yaml` with `corepack pnpm install`.

- [ ] **Step 6: Verify reproducibility**

Run under Node 24 in the target worktree: `node --version` and
`corepack pnpm install --frozen-lockfile`

Expected: Node reports `v24.x` and installation passes from the committed manifest and lockfile.
Node 25, an inaccessible Corepack cache, or a missing lockfile blocks this step; do not weaken the
version pin or substitute npm.

- [ ] **Step 7: Commit the task**

Run: `git add package.json pnpm-lock.yaml .node-version biome.json tsconfig.json tsconfig.build.json vitest.config.ts`

Run: `git commit -m "build: establish clean NestJS migration branch"`

If Git identity is missing, report the commit blocker without inventing identity; leave only reviewed files staged.

### Task 2: Generate A Machine-Checkable Legacy Capability Inventory

**Files:**
- Create in target worktree: `scripts/migration/inventory-legacy.mts`
- Create in target worktree: `test/migration/inventory-legacy.spec.ts`
- Create in target worktree: `docs/nestjs-migration/capability-inventory.json`
- Create in target worktree: `docs/nestjs-migration/capability-inventory.md`

**Interfaces:**
- Consumes: an explicit `LEGACY_WORKTREE` path pointing to the `main` worktree
- Produces: typed `CapabilityInventory` JSON and human-readable Markdown with stable identifiers for routes, sockets, jobs, AdminJS, providers, persistence, and operations

- [ ] **Step 1: Write the failing inventory parser tests**

Define fixtures for Express `app.use`, router methods, Socket.IO `.on`/`.emit`, scheduled job imports/cron registrations, and AdminJS resources/actions. Assert each becomes an inventory item with `id`, `kind`, `sourceFile`, `legacyOwner`, `risk`, `targetModule`, `parityCases`, `status`, `reviewVerdict`, `cutoverState`, and `rollbackState`.

- [ ] **Step 2: Verify RED**

Run: `corepack pnpm vitest run test/migration/inventory-legacy.spec.ts`

Expected: FAIL because the inventory generator and types do not exist.

- [ ] **Step 3: Implement structured inventory extraction**

Use the TypeScript compiler API for JavaScript/TypeScript syntax and structured JSON/Prisma parsing where applicable. Do not use regex-only extraction for source structure. Mark dynamically unresolved registrations as explicit `unknown` items instead of omitting them.

- [ ] **Step 4: Add manual-evidence sections**

Inventory configuration/startup, middleware ordering, Prisma/raw queries, payment/media/email/OAuth/AI/IPFS/AEKO adapters, deployment files, environment variables, and externally triggered behavior that static route extraction cannot fully classify.

- [ ] **Step 5: Verify GREEN**

Run: `corepack pnpm vitest run test/migration/inventory-legacy.spec.ts`

Expected: PASS.

- [ ] **Step 6: Generate the repository inventory**

Run: `corepack pnpm tsx scripts/migration/inventory-legacy.mts --legacy-worktree C:\Users\olaitan\Dev\aeko\backend`

Expected: JSON and Markdown are generated, every discovered item has a stable identifier, and unresolved behavior is visible as `unknown` rather than silently absent.

- [ ] **Step 7: Reviewer inventory audit**

The reviewer compares generated output with `server.js`, `routes/**`, `middleware/**`, `sockets/**`, `jobs/**`, `admin.js`, `config/**`, `services/**`, `prisma/schema.prisma`, deployment files, and provider integrations. Missing categories block the task.

- [ ] **Step 8: Commit the task**

Run: `git add scripts/migration test/migration docs/nestjs-migration/capability-inventory.json docs/nestjs-migration/capability-inventory.md`

Run: `git commit -m "docs: inventory legacy backend capabilities"`

### Task 3: Establish Dual-Runtime Black-Box Contract Infrastructure

**Files:**
- Create in target worktree: `test/parity/contracts.ts`
- Create in target worktree: `test/parity/http-runner.ts`
- Create in target worktree: `test/parity/socket-runner.ts`
- Create in target worktree: `test/parity/effect-recorder.ts`
- Create in target worktree: `test/parity/parity-runner.spec.ts`
- Create in target worktree: `docs/nestjs-migration/parity-report.schema.json`

**Interfaces:**
- Consumes: `LEGACY_BASE_URL`, `NEST_BASE_URL`, disposable test identities/data, and typed provider fakes
- Produces: `ParityCase`, `ParityResult`, and a JSON report comparing transport output and durable effects across both runtimes

- [ ] **Step 1: Write failing parity-runner tests**

Create local fake HTTP and Socket.IO targets whose responses intentionally differ. Assert the runner reports status/header/body, cookie, event/acknowledgement, database-effect, provider-effect, and intentional-exception differences with the case identifier.

- [ ] **Step 2: Verify RED**

Run: `corepack pnpm vitest run test/parity/parity-runner.spec.ts`

Expected: FAIL because the parity interfaces and runners do not exist.

- [ ] **Step 3: Implement the typed parity model**

Define discriminated unions for HTTP, Socket.IO, job, webhook, provider, database, and blockchain cases. Values representing money or chain units use strings or bigint-safe serialization, never unsafe JavaScript numbers.

- [ ] **Step 4: Implement comparison and redaction**

Normalize only approved nondeterministic fields such as generated IDs and timestamps. Redact secrets and personal data. Do not normalize away status, field names, authorization outcomes, money values, chain values, ownership, or side effects.

- [ ] **Step 5: Verify GREEN**

Run: `corepack pnpm vitest run test/parity/parity-runner.spec.ts`

Expected: PASS and the intentionally different fixtures produce an actionable mismatch report.

- [ ] **Step 6: Commit the task**

Run: `git add test/parity docs/nestjs-migration/parity-report.schema.json`

Run: `git commit -m "test: add dual-runtime parity harness"`

### Task 4: Create The Minimal NestJS Operational Foundation

**Files:**
- Create in target worktree: `src/main.ts`
- Create in target worktree: `src/app.module.ts`
- Create in target worktree: `src/config/configuration.ts`
- Create in target worktree: `src/common/request-id.middleware.ts`
- Create in target worktree: `src/common/sanitized-logger.ts`
- Create in target worktree: `src/common/http-exception.filter.ts`
- Create in target worktree: `src/prisma/prisma.module.ts`
- Create in target worktree: `src/prisma/prisma.service.ts`
- Create in target worktree: `src/health/health.module.ts`
- Create in target worktree: `src/health/health.controller.ts`
- Create in target worktree: `test/foundation/configuration.spec.ts`
- Create in target worktree: `test/foundation/health.e2e-spec.ts`

**Interfaces:**
- Consumes: validated environment and the existing Prisma schema
- Produces: `createApp(): Promise<INestApplication>`, `/health/live`, `/health/ready`, request correlation, sanitized logs, and graceful database lifecycle

- [ ] **Step 1: Write failing configuration and health tests**

Assert invalid/missing database configuration fails startup, liveness succeeds without database access, readiness succeeds after `SELECT 1`, readiness returns `503` on database failure, errors use stable envelopes, and logs never include a supplied secret-bearing raw exception.

- [ ] **Step 2: Verify RED**

Run: `corepack pnpm vitest run test/foundation/configuration.spec.ts test/foundation/health.e2e-spec.ts`

Expected: FAIL because the Nest foundation does not exist in the clean worktree.

- [ ] **Step 3: Implement minimal foundation**

Use constructor injection, feature modules, explicit return types, Zod environment validation, Prisma lifecycle hooks, trust proxy `1`, configured parser limits, request IDs, sanitized structured logging, and graceful shutdown. Do not import legacy Express routes or jobs.

- [ ] **Step 4: Verify GREEN and static quality**

Run: `corepack pnpm vitest run test/foundation/configuration.spec.ts test/foundation/health.e2e-spec.ts`

Run: `corepack pnpm typecheck`

Run: `corepack pnpm lint`

Expected: PASS.

- [ ] **Step 5: Commit the task**

Run: `git add src test/foundation`

Run: `git commit -m "feat: add clean NestJS operational foundation"`

### Task 5: Produce The Domain Migration Programme

**Files:**
- Create in target worktree: `docs/nestjs-migration/program.md`
- Create in target worktree: `docs/superpowers/plans/domains/*.md`
- Modify in target worktree: `docs/nestjs-migration/capability-inventory.json`

**Interfaces:**
- Consumes: reviewed capability inventory, dependency graph, risk classification, and parity harness
- Produces: ordered bounded domain plans with explicit role ownership, acceptance criteria, cutover, and rollback gates

**Required programme groups and ownership:**

| Order | Programme group | Candidate Nest domain ownership | Required specialist | Current owner through Tasks 1-5 |
| ---: | --- | --- | --- | --- |
| 0 | Foundation, inventory, parity and deployment routing | NestJS backend engineer | Legacy engineer and reviewer provide evidence | Express for all product capabilities; Nest has operational probes only after Task 4 |
| 1 | Public low-risk routes, beginning with waitlist | Waitlist/public module | Legacy engineer, reviewer | Express |
| 2 | Auth, OAuth/sessions, users, profiles, interests, privacy, blocking, security, 2FA, notifications, reports and support | Auth/users/security modules | Legacy engineer, reviewer | Express |
| 3 | Posts, comments, status, debates, challenges, spaces, communities and content visibility | Content/social/community modules | Legacy engineer; blockchain engineer for anchoring/NFT crossover | Express |
| 4 | Media uploads/editing, Cloudinary, Pinata/IPFS, email, AI/bots and other provider adapters | Media/provider modules plus consuming domains | Legacy engineer; reviewer for disclosure/privacy | Express |
| 5 | Chat, enhanced chat, livestream, video calls and Socket.IO rooms/events | Messaging/live modules | Legacy engineer, reviewer | Express |
| 6 | Plans, subscriptions, Paystack/Stripe/Flutterwave, community payments, webhooks, coins and reconciliation | Billing/payments modules | Legacy engineer, reviewer; blockchain engineer only for genuine AEKO crossover | Express |
| 7 | AdminJS resources, admin auth/2FA, exports, moderation and operational actions | Admin/operations module | Legacy engineer, reviewer | Express |
| 8 | Wallet, NFT, marketplace, rewards, staking, post anchoring and AEKO jobs/adapters | Wallet/NFT/marketplace/rewards/staking modules | Blockchain integration engineer and reviewer are mandatory | Express |
| 9 | Remaining jobs, deployment cutovers and final Express removal | Owning domain plus operations | Reviewer; blockchain engineer where applicable | Express until each later explicit cutover |

Each domain manifest contains a machine-readable front matter or JSON companion listing inventory
IDs, dependencies, planner/legacy/Nest/specialist/reviewer roles, parity case IDs, current owner,
candidate owner, cutover state and rollback state. Shared dependencies are referenced but inventory
items are owned by exactly one group. Unsupported, broken, unmounted and stale-configuration
capabilities remain explicit items; they are not silently treated as migrated.

- [ ] **Step 1: Group inventory items by complete vertical slice**

Create groups for foundation/public routes; auth/users/security; content/social; communities; chat/realtime/livestream; payments/subscriptions/webhooks/coins; AdminJS/operations; media/providers; and wallet/NFT/marketplace/rewards/staking/AEKO. Every inventory identifier must appear in exactly one group or in a documented shared-foundation dependency.

- [ ] **Step 2: Validate programme coverage mechanically**

Add a test that loads the inventory and all domain plan manifests, failing when an item is absent, duplicated, assigned to an invalid role, or sequenced before a required dependency.

- [ ] **Step 3: Verify RED then GREEN**

Run before plan manifests exist: `corepack pnpm vitest run test/migration/program-coverage.spec.ts`

Expected: FAIL with uncovered inventory identifiers.

Create the domain manifests and rerun.

Expected: PASS with zero unknown, uncovered, or duplicate assignments. If inventory still contains genuine unknowns, the test remains failing and the programme is blocked until they are classified.

- [ ] **Step 4: Write executable domain plans**

Each domain plan names exact source/test files, legacy handoff evidence, shared contract cases, database/provider effects, TDD steps, specialist role requirements, cutover owner, rollback procedure, and reviewer gate. Do not place implementation placeholders in plans.

- [ ] **Step 5: Select the first production slice**

Use dependency/risk evidence to select the waitlist route as the first low-risk complete slice unless the reviewed inventory proves a smaller prerequisite. Record Express as current owner and Nest as candidate.

The first-slice plan must enumerate the actual waitlist methods/paths, AdminJS export dependency,
Prisma `WaitlistEntry` effects, duplicate-email behavior, validation/error envelopes and any email or
analytics side effects found by the audited inventory. Selection is planning only: production
routing stays on Express and `cutoverState` stays `express-owner`.

- [ ] **Step 6: Independent reviewer verdict**

The reviewer verifies worktree isolation, inventory completeness, parity infrastructure, foundation quality, programme coverage, Node/pnpm reproducibility, and absence of premature legacy deletion. A Block returns to the owning role.

- [ ] **Step 7: Commit the task**

Run: `git add docs/nestjs-migration/program.md docs/superpowers/plans/domains test/migration/program-coverage.spec.ts docs/nestjs-migration/capability-inventory.json`

Run: `git commit -m "plan: define complete NestJS migration programme"`

### Task 6: Execute Domain Plans Until Final Legacy Removal

**Files:**
- Consume: `docs/superpowers/plans/domains/*.md`
- Modify: `docs/nestjs-migration/capability-inventory.json`
- Modify: `docs/nestjs-migration/program.md`

**Interfaces:**
- Consumes: one reviewer-approved bounded domain plan at a time
- Produces: migrated NestJS slices, parity evidence, single-owner cutovers, and eventually a branch with no Express runtime

- [ ] **Step 1: Execute each domain through the repository workflow**

For every domain: planner acceptance criteria, legacy behavior handoff, reviewer defect classification, Nest implementation, blockchain participation where applicable, shared parity execution, single-owner cutover evidence, rollback evidence, and reviewer Pass.

- [ ] **Step 2: Update inventory atomically after each reviewer Pass**

Mark only verified items complete. Record current owner, parity report, deployment state, and rollback state. Never bulk-mark domains complete based on directory presence or compilation.

- [ ] **Step 3: Run the full quality and parity suite after every cutover**

Run under Node 24: `corepack pnpm install --frozen-lockfile`

Run: `corepack pnpm quality`

Run all environment-backed HTTP, Socket.IO, job, payment, provider, AdminJS, and blockchain parity suites required by the changed domain.

- [ ] **Step 4: Perform final Express removal only after full inventory Pass**

Delete legacy Express runtime entry points, routes, middleware, sockets, jobs, AdminJS Express wiring, and Express-only dependencies. Retain shared Prisma assets and durable compatibility evidence. Add a static test that fails on active Express imports, route mounts, listeners, or duplicate scheduled jobs.

- [ ] **Step 5: Verify final clean-branch completion**

Require zero unknown/unreviewed inventory items, all quality/parity gates passing, production single-owner evidence, exercised rollback, no Express runtime/dependencies, and independent reviewer release Pass.
