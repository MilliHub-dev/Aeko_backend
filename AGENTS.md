# Aeko Backend — agent entry point

This repository contains backend application code only. The authoritative engineering-agent system
lives in [`.agents/`](.agents/README.md). Claude and Codex agent files are thin callers and must not
duplicate doctrine.

## Authority

Apply [`.agents/doctrine/00-authority.md`](.agents/doctrine/00-authority.md). Repository evidence
outranks confidence, stale plans, comments, and marketing claims.

## Current runtime and approved direction

The executable backend is currently an Express application rooted at `server.js`, with route files,
Socket.IO systems, scheduled jobs, AdminJS, Prisma/PostgreSQL, payment providers, media/IPFS
integrations, and AEKO chain clients.

Migration to NestJS is an approved project direction, but the current Express behavior remains the
runtime truth until a route is explicitly migrated and cut over.

The target is an in-place NestJS modular monolith under `src/**`, not Laitstyles' `apps/api/**`
layout, because this repository is already a standalone backend. Do not create microservices,
empty module scaffolds, a second ORM, or speculative shared packages.

## Roles

Dispatch through the [orchestrator](.agents/roles/orchestrator.md).

| Role | Responsibility |
| --- | --- |
| [orchestrator](.agents/roles/orchestrator.md) | Routing, sequence, handoffs, scope and delivery gates. |
| [planner](.agents/roles/planner.md) | Small executable plans, compatibility criteria and migration sequencing. |
| [legacy Express engineer](.agents/roles/legacy-express-engineer.md) | Current Express behavior, urgent fixes, compatibility evidence and legacy source. |
| [NestJS backend engineer](.agents/roles/nestjs-backend-engineer.md) | Target `src/**` architecture and route-by-route NestJS migration. |
| [blockchain integration engineer](.agents/roles/blockchain-integration-engineer.md) | AEKO RPC, explorer, transaction construction, confirmation and on-chain correctness. |
| [reviewer](.agents/roles/reviewer.md) | Independent verification and release verdict; no implementation ownership. |

There are no frontend, UI, mobile, design-system, or browser agents in this repository.

## Workflows

- [Backend feature](.agents/workflows/feature.md)
- [Bugfix](.agents/workflows/bugfix.md)
- [NestJS migration](.agents/workflows/nestjs-migration.md)
- [Blockchain-sensitive change](.agents/workflows/blockchain-change.md)

A change is incomplete until the reviewer applies
[validation and reporting](.agents/doctrine/validation-and-reporting.md).
