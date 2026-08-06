# Legacy Express Capability Handoff

## Evidence Boundary

- Reference worktree: `C:\Users\olaitan\Dev\aeko\backend`
- Runtime entry point: `server.js`
- Evidence date: 2026-08-06
- The reference worktree is intentionally not clean. Inventory generation must read the explicit
  worktree path and record its Git commit plus dirty-file state so regenerated evidence is
  attributable to the same snapshot.
- Counts below are discovery checks, not proof of unique public endpoints. The structured inventory
  must resolve router mount prefixes, nested routers, duplicate registrations, comments, and
  dynamically computed values through AST analysis or mark them `unknown`.

## HTTP And Middleware Surface

- `routes/**` contains 41 JavaScript route files and 328 syntactic router method registration lines.
- `server.js` mounts 38 active `/api/**` route families, plus AdminJS, Swagger, development uploads,
  webhook handling, and the terminal error handler.
- Global order is contract-sensitive: trust proxy `1`; cookie parser; CORS; development static
  uploads; AdminJS before body parsing; `/api/webhooks` before JSON parsing; JSON and URL-encoded
  parsers with `50mb` limits; Passport initialization; route-specific middleware; Swagger; terminal
  error handling.
- General API rate limiting is 100 requests per 15 minutes. Security routes use 10 requests per 15
  minutes. Both use standard headers and legacy-envelope JSON messages.
- Blocking and privacy middleware are applied selectively at mount time. The inventory must retain
  exact order and distinguish post interaction, messaging access, profile access, response-post
  filtering, and profile privacy checks.
- Authentication, administrator checks, 2FA, community policy, payment validation, upload handling,
  and route-local middleware also exist under `middleware/**`; mount-only extraction is incomplete.

### Unresolved HTTP Items

- `routes/postTransferRoutes.js` contains handlers but has no active mount in `server.js`.
- `routes/adminAuth.js` contains handlers, while its apparent mount is commented out.
- Router methods built from computed paths, arrays, aliases, or nested routers must be emitted as
  explicit unknowns when the full public method/path cannot be statically resolved.
- Swagger and `api.md` are supporting evidence only and must not create inventory routes absent from
  executable registration.

## Realtime Surface

- Three Socket.IO implementations are initialized by `server.js`: enhanced chat, enhanced live
  stream, and video call.
- Discovery found 208 syntactic `.on`/`.emit` lines: 51 in enhanced chat, 150 in enhanced live
  stream, and 7 in video call.
- Inventory items must distinguish inbound events, outbound events, acknowledgements, rooms, direct
  socket emits, namespace/broadcast emits, disconnect behavior, authorization, and durable Prisma
  effects. A raw `.on`/`.emit` count is insufficient.
- Computed event names, computed room names, payload construction, and indirect helper emissions are
  explicit unknowns until manually classified.

## Scheduled Jobs

- `jobs/expireSubscriptions.js` registers two daily cron schedules:
  - midnight: marks expired active subscriptions inactive and removes the golden tick;
  - 09:00: invokes seven-day expiration notification processing.
- `jobs/subscriptionExpirationNotifications.js` is an invoked job implementation, not an independent
  schedule registration. It must be linked as an effect dependency of the 09:00 schedule.
- `jobs/settleEpoch.js` registers a midnight cron slot but currently logs that settlement is skipped
  because the chain SDK operation is unavailable. It remains an operational and blockchain-sensitive
  ownership item even though it does not settle rewards.
- No lock or distributed single-owner mechanism was established by this static review. Job ownership,
  overlap behavior, timezone, retry, and multi-instance execution require explicit parity evidence.

## AdminJS And Operations

- `admin.js` registers the Prisma adapter and 21 Prisma resources: Community, Transaction, Interest,
  SupportTicket, SupportMessage, WaitlistEntry, User, Post, Comment, LiveStream, BotSettings,
  BotConversation, Ad, Debate, Challenge, Space, EnhancedMessage, Chat, Message, Status, and
  SubscriptionPlan.
- AdminJS uses an authenticated router, administrator lookup/password verification, cookie/session
  configuration, and an optional PostgreSQL session store.
- Custom operational actions include waitlist CSV export, user ban/unban, verification tick changes,
  subscription activation/statistics, content moderation/statistics, livestream end/ban/statistics,
  bot history clearing, and advertising approve/reject/statistics.
- `/admin/waitlist-export` has a session authorization check and reads waitlist rows ordered by
  creation time. Resource visibility, editable fields, destructive actions, and CSV serialization
  are contract and authorization items.
- Operational files include `Procfile`, `railway.json`, `deploy.sh`, `emergency-server.js`,
  `create-admin.js`, audit scripts, and package scripts. Some deployment documentation still names
  npm and MongoDB; treat these as stale/unknown until reconciled with the executable Prisma runtime.

## Persistence

- Prisma/PostgreSQL is the active application persistence boundary. The inventory must parse every
  model and enum from `prisma/schema.prisma`, unique constraints, Decimal/BigInt fields, migrations,
  raw queries, and transaction blocks.
- Prisma access is spread across routes, services, sockets, jobs, `admin.js`, and Passport. High-use
  files include post, enhanced livestream, enhanced chat, admin, profile, community payment, auth,
  privacy, 2FA, user, coin, and realtime implementations.
- Payment and community membership services use Prisma transactions and completed-status checks.
  Concurrency, replay, partial failure, retry metadata, and exact numeric representation require
  effect-aware tests rather than static classification alone.
- Any Sequelize or Mongo references are legacy/stale evidence, not permission to introduce or retain
  a second ORM in the Nest target.

## Providers And External Effects

- Payments: Paystack, Stripe, and Flutterwave code paths; raw-body webhook signature verification;
  payment initialization/verification; transaction persistence; retry metadata; subscription and
  community-access effects.
- Media: Cloudinary upload/delete behavior and local development upload serving.
- Public storage: Pinata/IPFS integration. Visibility and ownership must be checked before preserving
  any publication behavior.
- Identity and communications: Google OAuth/Passport, email delivery, notification delivery, and 2FA.
- AI and editing: bot/AI provider calls plus photo/video editing routes and media processing.
- Configuration inventory must record variable names only and redact values. `.env` is not tracked;
  `.env.example` includes stale Mongo and multiple provider/chain variables that require runtime-use
  classification.

## Blockchain-Sensitive Families

The blockchain integration engineer is required for these families and their cross-domain effects:

- post anchoring and any post transfer behavior;
- wallet linking, ownership, balances, and service-wallet use;
- NFT construction, minting, ownership, and metadata publication;
- marketplace listing, cancellation, purchase, transfer, fees, and reconciliation;
- rewards, vault state, claims, epochs, and the placeholder settlement job;
- staking, cooldown epochs, amounts, claims, and reconciliation;
- coin/transaction-construction routes where AEKO state or values are involved;
- community payment behavior that references chain configuration or service-wallet effects.

Inventory risk must remain `high` for signing, asset movement, ownership transfer, reward settlement,
and chain-value conversion. Static presence of an SDK call cannot establish confirmation or durable
reconciliation correctness.

## Known Defects Or Risks Not To Copy Blindly

- Unexpected errors in legacy handlers may expose raw error messages or provider details.
- Webhook error responses and logs may include provider error text; redaction requires review.
- Payment idempotency is partly status-based and must be tested under concurrent delivery/replay.
- Cron jobs have no proven cross-instance ownership lock.
- The settlement cron is a placeholder, not implemented chain settlement.
- Stale deployment and environment documentation conflicts with the current PostgreSQL runtime.
- Unmounted route files must not be treated as supported public contracts without runtime evidence.

## Inventory Acceptance Checks

The generated JSON/Markdown is incomplete unless it:

1. records the reference commit and dirty state;
2. resolves mount prefixes into full HTTP method/path identifiers;
3. retains middleware order and parser/webhook/AdminJS ordering;
4. emits unmounted and dynamically unresolved registrations as explicit unknown items;
5. separates Socket.IO inbound, outbound, acknowledgement, room, disconnect, auth, and effects;
6. distinguishes cron registrations from invoked job helpers;
7. includes all 21 AdminJS resources, authentication/session behavior, and custom actions;
8. includes Prisma schema, transactions, raw queries, numeric types, and concurrency assumptions;
9. includes provider, startup, configuration, logging, shutdown, CORS, proxy, deployment, and scripts;
10. marks every payment and blockchain-sensitive item high risk with the required specialist owner.
