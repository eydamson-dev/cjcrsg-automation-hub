# Handoff: cjcrsg-automation-hub

Date: 2026-09-13

## Project

Self-hosted Facebook publishing platform. Next.js dashboard, AdonisJS API, Prisma 7,
PostgreSQL, n8n automation, Cloudflare Tunnel. Repo: `git@github.com:eydamson-dev/cjcrsg-automation-hub.git` (branch `main`).

## Where we are

M1 and M2 are done and pushed to `main`. The next session picks up at M3 (core API).
Read `docs/plan.md` for the full M1 through M6 breakdown. Read `AGENTS.md` for the
decisions and guardrails. Read `docs/PROJECT.md` for the requirements baseline.

## What M2 delivered (based on docs/plan.md)

- Hand-rolled sessions on the `sessions` table via Prisma (`app/services/session_service.ts`).
  Random 32-byte token in an HttpOnly/SameSite=Lax cookie (`sm_session`), SHA-256 hash stored
  server-side, 30-day sliding expiry. Cookie is set/read with Adonis `plainCookie` (not `cookie`,
  which signs values; the plugin in `@japa/api-client` overrides `cookie()` too).
- Argon2id password hashing via `@node-rs/argon2` (`app/utils/password.ts`).
- `POST /api/v1/auth/login|logout|refresh`, `GET /api/v1/auth/me`
  (`app/controllers/auth_controller.ts`, `app/validators/auth.ts`).
- Named middleware `auth`, `admin`, `editor` (`start/kernel.ts`, `app/middleware/*`).
- State machine module `app/domain/post_state_machine.ts` encoding the `AGENTS.md`
  transitions, with unit tests.
- Storage abstraction: `StorageService` interface + `FilesystemStorage`
  (`app/services/storage/*`), driver registry in `config/storage.ts`.
- Audit log helper `app/services/audit_service.ts` (login/logout wired in).
- `db:seed` ace command (`commands/seed_admin.ts`) upserts an admin from `SEED_ADMIN_*`;
  refuses in production unless `SEED_ALLOWED=true`.
- Tests: 4 state-machine unit + 8 auth functional specs, green. `tests/bootstrap.ts` migrates
  and `tests/helpers/db.ts` truncates `cjcrsg_social_manager_test`. Setup requires a gitignored
  `apps/api/.env.test`.
- `docker-compose.yml`: `api` gets `STORAGE_*`/`SESSION_*` env and a `media_data` volume for
  `/data/social-manager`.

Exit criteria met: login/logout/me against Postgres work, transition guard covered by tests.
Manually verified against the containerized API (`/health` and login both 200).

## What is next: M3

Posts CRUD and post actions, assets, templates, accounts/pages. Details are in `docs/plan.md`.
In short:

- Posts CRUD with a polymorphic `type` field, plus `approve`, `schedule`, `cancel`, `publish`,
  `retry`, `duplicate`. Use `assertTransition` from `app/domain/post_state_machine.ts`.
- Assets upload and `/assets/:id/content` streaming via `storage()` from
  `app/services/storage/index.ts`. No raw paths exposed.
- Templates and social accounts/pages, tokens encrypted at rest (guardrail 8).

## Open items and gotchas

- AdonisJS v7 needs Node 24. Set `fnm use 24` before `pnpm dev:api` or `pnpm test`.
- `pnpm build` fails on `apps/web` until M4 scaffolds Next.js. Expected, not a blocker.
- `pnpm` is installed via `corepack enable pnpm`; the repo pins `pnpm@10.27.0`.
- `@japa/plugin-adonisjs` overrides the api-client `cookie()` macro to sign values. For the
  session cookie in tests use `.plainCookie('sm_session', value)` instead.
- The api container once booted detached from the compose network (empty
  `NetworkSettings.Networks`), causing `P1001 Can't reach postgres`. A
  `docker compose up -d --force-recreate api` reattached it. If the api crash-loops with
  P1001 while postgres is healthy, do that first.
- `FAILED -> editable` is undefined in the docs. `app/domain/post_state_machine.ts` encodes
  the `AGENTS.md` transitions exactly; revisit in M3 if retry exhaustion needs an edit path.
- Canva and Meta are deferred. Build M3 through M5 against mock providers. See
  `docs/plan.md` and `AGENTS.md`.
- Prisma 7 specifics are documented in `AGENTS.md` under "AdonisJS with Prisma".
- The generated Prisma client lives in `apps/api/generated/prisma` and is gitignored.
  Run `pnpm db:generate` after schema changes.

## Suggested skills

- `unslop` for all prose and docs the next agent writes.
- `recall` to rebuild working context from chat history if this handoff is stale.
- `handoff` to produce the next handoff after M3.

## Sensitive info

No credentials or keys are stored in the repo. Secrets live in gitignored `.env` files
(`.env`, `apps/api/.env`, `apps/api/.env.test`). Do not commit `.env`.