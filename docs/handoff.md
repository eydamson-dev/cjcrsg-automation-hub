# Handoff: cjcrsg-automation-hub

Date: 2026-09-13

## Project

Self-hosted Facebook publishing platform. Next.js dashboard, AdonisJS API, Prisma 7,
PostgreSQL, n8n automation, Cloudflare Tunnel. Repo: `git@github.com:eydamson-dev/cjcrsg-automation-hub.git` (branch `main`).

## Where we are

M1 through M4 are done and pushed. The next session picks up at M5 (n8n + internal API +
mock providers). Read `docs/plan.md` for the M1 through M6 breakdown. Read `AGENTS.md` for
decisions and guardrails. Read `docs/PROJECT.md` for requirements.

## What M4 delivered (based on docs/plan.md)

- `apps/web` is a real Next.js 16 dashboard (was a stub). Stack: App Router, Tailwind v4,
  shadcn/ui-style components (hand-wired, Radix primitives), TanStack Query v5, lucide icons.
- `next.config.ts` rewrites `/api/:path*` to `process.env.API_URL` so the browser only ever
  talks to one origin and the `sm_session` cookie stays same-origin. No CORS concerns.
- `proxy.ts` auth gate (Next 16 replaced `middleware.ts`; export must be named/`default` and
  the matcher must **exclude `/api`** or the proxied routes get redirected to `/login`).
- Pages: `/login`; dashboard (DRAFT/SCHEDULED/PUBLISHED/FAILED counts, upcoming, recent);
  `/posts` list with status/type filters, search, pagination, and a per-row actions menu
  (edit, duplicate, approve, schedule, publish, cancel, retry, delete dialogs); `/posts/new`,
  `/posts/[id]/edit` (type-aware editor with verse fields or media picker, template + schedule
  selects); `/posts/[id]` detail/preview incl. "Generate design"; read-only `/calendar`;
  `/media` (upload, thumbnail grid, metadata, delete); admin `/templates` CRUD and `/social`
  (list accounts, connect Facebook, pages table).
- `lib/api-client.ts` typed fetch wrapper + `lib/api.ts` endpoint map + `lib/types.ts` DTOs
  mirroring the API responses. Web types are local; moving them to `packages/types` remains a
  cleanup item.
- `apps/web/Dockerfile` (multi-stage, `output: 'standalone'`, server at `apps/web/server.js`)
  and a `web` service in compose (port 3000). `pnpm -r build`, `lint`, `typecheck` now all
  pass repo-wide, and the API test suite (49) stays green.

Exit met: manual create, save, approve, schedule flow works against the API, containerized;
verified through the running compose stack.

## What is next: M5

n8n + internal API + mock providers. Details are in `docs/plan.md`. In short:

- HMAC-signed internal endpoints under `/api/v1/internal/jobs/*`.
- Mock Canva and mock Facebook providers.
- n8n workflows: design generation, publish, scheduler (60s), retry.
- Idempotency key and dedupe on `external_post_id`.
- Define the n8n-to-API payload contract before writing the workflows (plan risk).

Exit: `DRAFT` through `PUBLISHED` end-to-end against mocks. Retry produces no duplicate.

## Open items and gotchas

- AdonisJS v7 needs Node 24. Set `fnm use 24` before `pnpm dev:api` or `pnpm test`.
- `pnpm` is installed via `corepack enable pnpm`; the repo pins `pnpm@10.27.0`.
- Next 16 evaluates `API_URL` in `next.config.ts` at build time; the image bakes it via a
  build arg. Compose sets it for `web`; a local `apps/web/.env.local` sets it for dev.
- The web proxy matcher must exclude `/api` (auth gate would otherwise eat proxied routes).
- `@japa/plugin-adonisjs` overrides the api-client `cookie()` macro to sign values; tests use
  `.plainCookie('sm_session', value)`. Its multipart upload needs an `fs.createReadStream`, so
  tests write temp files under `apps/web/tmp/test-uploads`.
- The api container once booted detached from the compose network (empty
  `NetworkSettings.Networks`), giving `P1001 Can't reach postgres`. A
  `docker compose up -d --force-recreate api` reattached it.
- Direct date validation: Vine's `vine.date()` rejects valid ISO strings. M3 converts date
  strings in controllers via `app/utils/date.ts` (`parseDate`/`optionalDate`).
- Adonis `MultipartFile` splits MIME into `file.type` + `file.subtype`; build the full MIME
  as `${file.type}/${file.subtype}` before matching.
- `/design` is a transition-only stub (DRAFT -> READY -> PROCESSING -> DESIGN_READY); real
  design generation is M5. `retry` needs a FAILED post, set by M5 internal callbacks.
- `FAILED -> editable` is undefined in the docs; revisit in M5 if retry exhaustion needs an
  edit path.
- Prisma 7 specifics are in `AGENTS.md` under "AdonisJS with Prisma". The generated client
  lives in `apps/api/generated/prisma` (gitignored); run `pnpm db:generate` after schema
  changes.
- dashboard-facing DTO types are duplicated in `apps/web/lib/types.ts`; consider moving to
  `packages/types` during M5.

## Suggested skills

- `unslop` for all prose and docs the next agent writes.
- `recall` to rebuild working context from chat history if this handoff is stale.
- `handoff` to produce the next handoff after M5.

## Sensitive info

No credentials or keys are stored in the repo. Secrets live in gitignored `.env` files
(`.env`, `apps/api/.env`, `apps/api/.env.test`, `apps/web/.env.local`). Do not commit `.env`.