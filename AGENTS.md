# AGENTS.md

Guidance for coding agents working on this repository. `docs/PROJECT.md` holds
the requirements and is the source of truth for what to build. `docs/plan.md`
holds the MVP build plan. This file holds how we build it, the decisions
already made, and what is still open.

## Stack

| Concern | Choice | Status |
| --- | --- | --- |
| Monorepo | pnpm workspaces | decided |
| Frontend | Next.js, App Router, latest stable | decided |
| Backend | AdonisJS v7 in TypeScript | decided |
| Database | PostgreSQL 16 | decided |
| ORM | Prisma 7 | decided, non-standard for AdonisJS |
| Auth | email and password, Argon2id, server-side sessions, HttpOnly cookies | decided |
| Storage | local filesystem via `FilesystemStorage` | decided for v1 |
| Automation | self-hosted n8n | decided |
| Reverse proxy | none, Cloudflare Tunnel | decided |
| Media | local filesystem, metadata in Postgres | decided |

### AdonisJS with Prisma

AdonisJS normally pairs with its own ORM, Lucid, and the auth layer in
`@adonisjs/auth` expects Lucid models. Prisma is the data layer here, so auth
and sessions are built directly on Prisma instead of Adonis Guard. Do not add
Lucid or `@adonisjs/auth`. Prisma stays the single data-access layer.

Prisma 7 specifics that are easy to forget:

- The generated client lives at `apps/api/generated/prisma` (gitignored). Run
  `pnpm db:generate` after schema changes.
- A driver adapter is required. The app uses `@prisma/adapter-pg` with `pg`.
- Database URL and migrations paths live in `apps/api/prisma.config.ts`, not
  the schema datasource block. The schema datasource keeps only `provider`.
- `importFileExtension = "js"` in the generator so the generated imports match
  AdonisJS's `.js` import convention.

AdonisJS v7 requires Node 24. The dev machine uses fnm; set it with
`fnm use 24` before `pnpm dev:api`. The container already runs `node:24-alpine`.

## Roles

`ADMIN` and `EDITOR` only in v1.

- `ADMIN` manages users, integrations, templates, system settings, and all post operations.
- `EDITOR` creates and edits posts, uploads media, schedules posts, and views posts.

Only `ADMIN` approves and publishes in v1. This may change when roles expand.

## Commands

```bash
pnpm install
pnpm dev:api        # apps/api, AdonisJS
pnpm dev:web        # apps/web, Next.js
pnpm -r build       # build all packages and apps
pnpm -r lint
pnpm -r typecheck
pnpm test           # apps/api tests (unit + functional, against social_manager_test)
pnpm db:generate    # prisma generate
pnpm db:migrate     # prisma migrate deploy
pnpm db:migrate:dev # prisma migrate dev (local, creates migrations)
pnpm db:seed        # upsert the initial admin from SEED_ADMIN_*
```

The API tests target a dedicated `cjcrsg_social_manager_test` database. Create
it once in Postgres, then provide `apps/api/.env.test` (gitignored; mirror
`apps/api/.env.example` with `DATABASE_URL` pointing at the test DB). The test
runner migrates and truncates that DB automatically.

The web app reads `API_URL` (the backend origin it proxies `/api/*` to) at
build time, so pass it as a build arg when containerizing:
`docker compose build --build-arg API_URL=http://api:3333 web`.

## Repo layout

```text
apps/web          Next.js admin dashboard
apps/api          AdonisJS application API
packages/types    shared TypeScript types
packages/validation shared validation schemas
packages/config   shared runtime configuration
infrastructure/   docker, postgres
n8n/workflows     n8n workflow definitions
docs/             architecture, database, api, deployment notes
docs/PROJECT.md   requirements baseline
docs/plan.md      MVP build plan
docker-compose.yml
```

## Architecture

- `apps/web` dashboard. Human-facing UI only. Handles post CRUD, scheduling
  metadata, approval, status display, and media management. It never calls
  external providers directly.
- `apps/api`. Owns auth, authz, business rules, Postgres access, post state
  transitions, asset metadata, integration abstractions, and calls to n8n.
- PostgreSQL. Source of truth for posts, users, sessions, assets, templates,
  social accounts and pages, publications, jobs, and audit logs.
- n8n. Runs automation only: design generation, Canva export, Facebook
  publishing, retries, scheduling. It never holds source-of-truth data and
  never shares application tables.
- Local filesystem. Holds uploaded and generated media, previews, and exports
  under `/data/social-manager`.

## Hard guardrails

These come from PROJECT.md section 20.

1. Record open questions. Do not turn them into hidden assumptions. Stop when a
   decision changes the implementation.
2. The dashboard and Postgres are authoritative. n8n is an executor.
3. Keep external providers behind service abstractions. Canva, Facebook, storage.
4. Publishing is idempotent. Retries never create duplicate Facebook posts.
5. Keep media binary out of Postgres.
6. Asset names and storage keys are unique. The original filename is metadata only.
7. Enforce post state transitions. No arbitrary status mutations.
8. Credentials stay server-side. Never send raw tokens to the frontend.
9. Abstract storage so MinIO or S3 can replace the filesystem later.
10. Keep v1 narrow. Reliable Facebook publishing is the goal.

## Schema corrections

These resolve contradictions in PROJECT.md.

- Publication time lives on `post_publications.published_at`, per platform. The
  `posts` table does not carry a competing `published_at`, except as a
  denormalized first-publication cache.
- `RETRY` is an action, not a status. The statuses are the enum in section 7.3.
  `CANCELLED` and `ARCHIVED` are terminal states with defined transitions.
- `POST /api/v1/posts` creates either post type through a `type` field.
  `POST /api/v1/posts/bible-verse` is an optional alias.
- `caption` is a shared `posts` column for both post types.
- `bible_verse_posts.verse_text` is user supplied, manual entry in v1.
- `DESIGN_READY` means the design is generated and previewable. The system sets
  it. `APPROVED` means a human signed off. `SCHEDULED` means the post has a
  `scheduled_at`.

## State machine

The backend enforces these transitions.

```text
DRAFT -> READY -> PROCESSING -> DESIGN_READY -> APPROVED -> SCHEDULED -> PUBLISHING -> PUBLISHED
PUBLISHING -> FAILED -> PUBLISHING
DRAFT/READY/SCHEDULED/FAILED -> CANCELLED
DRAFT/READY -> ARCHIVED
```

## Internal and n8n API

- Private endpoints live under `/api/v1/internal/jobs/*` and
  `/api/v1/internal/scheduler/*`. They use the `internal` middleware only — no
  session auth.
- Requests are signed with HMAC-SHA256. The protocol is decided:
  - Canonical string: `METHOD\n<pathname>\n<X-Timestamp>\n<X-Request-Id>\n<canonicalBody>`.
  - `canonicalBody` is `JSON.stringify` of a recursively key-sorted copy of the
    parsed JSON body, empty string when there is no body (the bodyparser never
    exposes the raw body for parsed JSON, so signing works on the canonical
    form; both sides implement `stableStringify` in `app/services/hmac.ts`).
  - `X-Signature` is lowercase hex `HMAC-SHA256(INTERNAL_API_SECRET, canonical)`.
  - `X-Timestamp` must be within ±`INTERNAL_API_TIMESTAMP_WINDOW` (default 300s).
  - `X-Request-Id` is required.
- Endpoints: `GET /jobs/next?jobType=` (claim, 204 when idle), `POST /jobs/design`,
  `POST /jobs/publish`, `POST /jobs/result`, `GET /scheduler/due`,
  `POST /scheduler/enqueue`.
- n8n reads the shared secret from `INTERNAL_API_SECRET`, the API base from
  `N8N_API_BASE`, and imports workflows from `n8n/workflows` via
  `infrastructure/scripts/import-n8n.sh`.

## Mock providers and jobs

- Mock Canva and mock Facebook live in the API at `app/services/providers/`
  behind the `CanvasProvider` and `FacebookProvider` interfaces. n8n drives them
  over HTTP; the API owns job state and the provider abstraction.
- `MOCK_DESIGN_FAIL_ON_ATTEMPT` and `MOCK_FACEBOOK_FAIL_ON_ATTEMPT` (0 = always
  succeed) fail every attempt below the threshold to exercise the retry path.
- Design generation is async: `POST /posts/:id/design` enqueues a
  `GENERATE_DESIGN` job and leaves the post in `PROCESSING`. `DESIGN_READY` is
  set by the internal design job. A `PROCESSING` post with a FAILED design job
  can be re-triggered from the dashboard.
- Auto-retry is decided and implemented at claim time in
  `app/domain/retry_policy.ts`: delays are 1 minute, 5 minutes, 30 minutes,
  then manual, and only for jobs with `attempts < maxAttempts`. `publish.json`
  polling `/jobs/publish` picks up both manual and auto retries.

## Defaults in use

These are assumptions and easy to change.

- Next.js latest stable, App Router.
- Retry backoff: 1 minute, 5 minutes, 30 minutes, then manual. At most 5 attempts.
  Auto-retry is evaluated in `claim()`, not by n8n timers. The `posts` table
  carries `published_at` as a denormalized first-publication cache only.
- Scheduler runs every 60 seconds, configurable.
- The backend generates the idempotency key. It stores the key on
  `publishing_jobs` and `post_publications`, and dedupes on `external_post_id`
  before publishing.
- Storage provider enum value: `local`.
- Calendar: read-only month view in v1. Drag-and-drop is deferred.
- Backup retention: 7 daily, 4 weekly, 3 monthly.

## Open items

Verify these during implementation. Do not decide them silently.

- Canva Pro design and export workflow without Autofill. Verify against the
  Canva Connect API.
- Meta Graph API version, OAuth flow, permissions, Page token lifecycle, app review.
- Proxmox storage mount method: ZFS dataset, dedicated disk, or bind mount.
- Bible source is manual entry for v1. Any future API or licensing is out of scope.
- Whether a FAILED post needs an edit path after retry exhaustion. Process:
  `POST /posts/:id/design` while PROCESSING with a FAILED design job is the
  design retry path; publish retries go through dashboard retry or auto-retry.

## V1 acceptance scope

1. Log in to the dashboard.
2. Create a Bible-verse post or an image post with a caption.
3. Select a Canva template.
4. Upload or select the source image.
5. Save the post.
6. Generate the design through the Canva integration.
7. Preview the result.
8. Approve or schedule the post.
9. n8n publishes to Facebook through the Meta API.
10. The app records the publication status and external post id.
11. View the result in the dashboard.
12. Retry a failed job without creating a duplicate publication.

Everything else in PROJECT.md section 18 is deferred.
