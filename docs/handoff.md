# Handoff: cjcrsg-automation-hub

Date: 2026-09-13

## Project

Self-hosted Facebook publishing platform. Next.js dashboard, AdonisJS API, Prisma 7,
PostgreSQL, n8n automation, Cloudflare Tunnel. Repo: `git@github.com:eydamson-dev/cjcrsg-automation-hub.git` (branch `main`).

## Where we are

M1 is done and pushed to `main` at commit `9c76c90`. The next session picks up at M2.
Read `docs/plan.md` for the full M1 through M6 breakdown. Read `AGENTS.md` for the
decisions and guardrails. Read `docs/PROJECT.md` for the requirements baseline.

## What M1 delivered (based on docs/plan.md)

- AdonisJS v7 backend scaffolded by hand in `apps/api`. No Lucid, no `@adonisjs/auth`.
- Prisma 7 with `@prisma/adapter-pg`, `prisma.config.ts`, and `importFileExtension = "js"`
  so the generated client matches AdonisJS build output.
- Full `apps/api/prisma/schema.prisma`: 12 tables, all enums, idempotency keys on
  `publishing_jobs` and `post_publications`, `posts.published_at` dropped.
- First migration applied (`apps/api/prisma/migrations/`).
- `apps/api/Dockerfile` and an `api` service in `docker-compose.yml` (node:24-alpine,
  `prisma migrate deploy` on boot).
- Workspace `pnpm -r lint` and `pnpm -r typecheck` pass for all packages.

Exit criterion met: `docker compose up api` boots, migrates, and `/health` returns
`{"status":"ok"}`. `pnpm dev:api` also works natively.

## What is next: M2

Auth, RBAC, state machine, storage. Details are in `docs/plan.md`. In short:

- Hand-rolled sessions on the `sessions` table via Prisma. Session id in an
  HttpOnly/SameSite/Secure cookie. Argon2id for password hashing.
- `ADMIN` and `EDITOR` middleware.
- A state-machine module that rejects invalid transitions. The transitions are in
  `AGENTS.md`.
- `FilesystemStorage` plus a `StorageService` interface. Audit log helper.

## Open items and gotchas

- AdonisJS v7 needs Node 24. Set `fnm use 24` before `pnpm dev:api`.
- `pnpm -r build` fails on `apps/web` until M4 scaffolds Next.js. Expected, not a blocker.
- Canva and Meta are deferred. Build M2 through M5 against mock providers. See
  `docs/plan.md` and `AGENTS.md`.
- Prisma 7 specifics are documented in `AGENTS.md` under "AdonisJS with Prisma".
- The generated Prisma client lives in `apps/api/generated/prisma` and is gitignored.
  Run `pnpm db:generate` after schema changes.

## Suggested skills

- `unslop` for all prose and docs the next agent writes.
- `recall` to rebuild working context from chat history if this handoff is stale.
- `handoff` to produce the next handoff after M2.

## Sensitive info

No credentials or keys are stored in the repo. Secrets live in gitignored `.env` files.
Do not commit `.env`.
