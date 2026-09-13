# Handoff: cjcrsg-automation-hub

Date: 2026-09-13

## Project

Self-hosted Facebook publishing platform. Next.js dashboard, AdonisJS API, Prisma 7,
PostgreSQL, n8n automation, Cloudflare Tunnel. Repo: `git@github.com:eydamson-dev/cjcrsg-automation-hub.git` (branch `main`).

## Where we are

M1 through M5 are done locally and green (lint, typecheck, build, 67 API tests).
M1–M4 are pushed. M5 is uncommitted; commit it next. The next session picks up at
M6 (ops + release). Read `docs/plan.md` for the M1 through M6 breakdown. Read
`AGENTS.md` for decisions and guardrails (the HMAC protocol and retry policy are
now recorded in the "Internal and n8n API" / "Mock providers and jobs" sections).

## What M5 delivered

- HMAC-signed internal API (`internal` middleware, no session auth):
  `GET /jobs/next?jobType=`, `POST /jobs/design`, `POST /jobs/publish`,
  `POST /jobs/result`, `GET /scheduler/due`, `POST /scheduler/enqueue`.
  Signing protocol: `METHOD\n<pathname>\n<X-Timestamp>\n<X-Request-Id>\n<canonicalBody>`.
  `canonicalBody` = `JSON.stringify(stableStringify(parsedBody))`, empty for no body.
  ±`INTERNAL_API_TIMESTAMP_WINDOW` (300s). Shared secret `INTERNAL_API_SECRET`.
- `app/services/providers/` with `CanvasProvider` / `FacebookProvider` interfaces
  and mock implementations. Env knobs `MOCK_DESIGN_FAIL_ON_ATTEMPT` and
  `MOCK_FACEBOOK_FAIL_ON_ATTEMPT` (0 = always succeed) fail attempts below the
  threshold to exercise retries.
- Async design: `POST /posts/:id/design` enqueues a `GENERATE_DESIGN` job and
  leaves the post `PROCESSING`; `DESIGN_READY` is set by the internal design job,
  which writes a `GENERATED_IMAGE` asset. Re-triggering a `PROCESSING` post whose
  design job FAILED is the design retry path.
- Publishing: status transitions `PUBLISHING -> PUBLISHED/FAILED` happen through
  `/jobs/publish` and `/jobs/result`; dedupe on `external_post_id`
  (`mock-fb-<postId>`); `posts.published_at` added as a denormalized
  first-publication cache (migration `20260913075939_add_posts_published_at`).
- Auto-retry at claim time (`app/domain/retry_policy.ts`): 1m/5m/30m then manual,
  at most 5 attempts. `claim()` creates a new job + resets publication/post, so
  manual dashboard retries and automatic retries share one path.
- Four n8n workflows under `n8n/workflows/` (design, publish, scheduler, retry),
  imported via `infrastructure/scripts/import-n8n.sh` (uses `n8n import:workflow
  --separate`). Compose passes `INTERNAL_API_SECRET` + `N8N_API_BASE=http://api:3333`
  to n8n and mounts `./n8n/workflows:/workflows:ro`. Workflows ship inactive; activate
  them in the n8n UI.
- Web: post detail refetches every 5s while `PROCESSING`/`PUBLISHING`; the
  "Generate design" button also shows for `PROCESSING` posts with a FAILED design job.

Exit for M5 is met: `DRAFT -> … -> PUBLISHED` runs end-to-end over real HTTP in the
functional suite (design job, publish job, idempotent reruns, dedupe, scheduler
due/enqueue, result + dashboard retry + auto-retry with exactly one
`external_post_id`, missing-token failure).

## What is next: M6

Ops + release. Details in `docs/plan.md`. In short:

- Health checks for the compose services, job and publication history views.
- Backup jobs (retention 7 daily / 4 weekly / 3 monthly), `cloudflared` service to
  expose web and n8n.

## Open items and gotchas

- AdonisJS v7 needs Node 24. Set `fnm use 24` before `pnpm dev:api` or `pnpm test`.
- pnpm is installed via `corepack enable pnpm`; the repo pins `pnpm@10.27.0`.
- HMAC: the body must be signed in canonical form, not raw — Adonis bodyparser never
  exposes the raw body for parsed JSON (`request.raw()` is only set for unparseable/
  multipart). Both sides share `stableStringify` in `app/services/hmac.ts`. The n8n
  Code nodes duplicate that helper; if the canonical form ever changes, update
  `n8n/workflows/*.json` signers too.
- The test helper (`tests/helpers/internal.ts`) signs requests; remember that the
  header timestamp/request-id and the signed values must be computed from the SAME
  values (compute them once per request). This bug bit the first run of the suite.
- `MOCK_FACEBOOK_FAIL_ON_ATTEMPT` is read per request (env-driven); toggle it by
  recreating the api container, not by workflow changes.
- GET `/jobs/next` requires `jobType` query (validator is strict); `/scheduler/due`
  accepts optional `now`.
- Direct date validation: Vine `vine.date()` rejects valid ISO strings. The
  scheduler controller parses `now` manually.
- `FAILED -> editable` is still undefined. Auto-retry exhausts publish attempts and
  leaves the post FAILED; the dashboard offers retry/cancel only.
- The api container once booted detached from the compose network (empty
  `NetworkSettings.Networks`), giving `P1001 Can't reach postgres`. Recreate it:
  `docker compose up -d --force-recreate api`.
- dashboard-facing DTO types are duplicated in `apps/web/lib/types.ts`; moving to
  `packages/types` remains a cleanup item.

## Suggested skills

- `unslop` for all prose and docs.
- `recall` to rebuild working context from chat history if this handoff is stale.
- `handoff` to produce the next handoff after M6.

## Sensitive info

No credentials or keys are stored in the repo. Secrets live in gitignored `.env`
files (`.env`, `apps/api/.env`, `apps/api/.env.test`, `apps/web/.env.local`).
`INTERNAL_API_SECRET` uses the placeholder `change-me` in examples; set a real value
in production. Do not commit `.env`.