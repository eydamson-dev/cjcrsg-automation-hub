# AGENTS.md

Guidance for coding agents working on this repository. `docs/PROJECT.md` is the
requirements baseline and source of truth for *what* to build; this file
captures *how* we build it, the decisions already made, and the items still open.

## Stack (decided)

| Concern | Choice | Status |
| --- | --- | --- |
| Monorepo | pnpm workspaces | decided |
| Frontend | Next.js (App Router, latest stable) | framework decided; exact version = default |
| Backend | AdonisJS (TypeScript) | decided |
| Database | PostgreSQL 16 | decided |
| ORM | Prisma | decided (non-standard for AdonisJS — see caveat below) |
| Auth | email+password, Argon2id, server-side sessions, HttpOnly cookies | decided direction |
| Storage | local filesystem via `FilesystemStorage` abstraction | decided (v1) |
| Automation | self-hosted n8n | decided |
| Reverse proxy | none — Cloudflare Tunnel (`cloudflared`) | decided |
| Media | local filesystem, metadata in Postgres | decided |

### Caveat: AdonisJS + Prisma

AdonisJS is normally paired with its own ORM (Lucid) and its auth layer
(`@adonisjs/auth`) expects Lucid models. Because Prisma was chosen for the data
layer, the auth/session implementation is **hand-rolled on top of Prisma** rather
than using Adonis Guard. Do not reintroduce Lucid or `@adonisjs/auth`; keep
Prisma as the single data-access layer.

## Roles (v1)

`ADMIN` and `EDITOR` only.

- `ADMIN`: user management, integrations, templates, system settings, all post operations.
- `EDITOR`: create/edit posts, upload media, schedule posts, view posts.

Approval/publishing in v1 is performed by `ADMIN` (or any role as later defined).

## Commands

```bash
pnpm install
pnpm dev:api        # apps/api — AdonisJS
pnpm dev:web        # apps/web — Next.js
pnpm -r build       # build all packages/apps
pnpm -r lint
pnpm -r typecheck
pnpm db:generate    # prisma generate
pnpm db:migrate     # prisma migrate deploy
```

Commands are placeholders until the AdonisJS/Next.js apps are fully scaffolded
in M2/M4; update this section as those land.

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
docker-compose.yml
```

## Architecture / responsibility boundaries

- **Dashboard (apps/web)**: human-facing UI only — post CRUD, scheduling
  metadata, approval, status display, media management. No direct external
  provider calls.
- **API (apps/api)**: auth, authz, business rules, Postgres access, post state
  transitions, asset metadata, integration abstractions, communication with n8n.
- **PostgreSQL**: source of truth for posts, users, sessions, assets, templates,
  social accounts/pages, publications, jobs, audit logs.
- **n8n**: automation/orchestration only (design generation, Canva export,
  Facebook publishing, retries, scheduling). Never the source of truth; never
  shares application tables.
- **Local filesystem**: uploaded/generated media, previews, exports under
  `/data/social-manager`.

## Hard guardrails (from PROJECT.md §20)

1. Do not turn open questions into hidden assumptions — record and stop when a
   decision materially changes implementation.
2. Dashboard + Postgres are authoritative; n8n is an executor.
3. Keep external providers behind service abstractions (Canva, Facebook, storage).
4. Publishing must be idempotent — retries must never create duplicate Facebook posts.
5. Keep media binary out of Postgres.
6. Unique asset names/storage keys; original filename is metadata only.
7. Enforce post state transitions; no arbitrary status mutations.
8. Credentials stay server-side; never send raw tokens to the frontend.
9. Storage is abstracted so MinIO/S3 can replace the filesystem later.
10. Keep v1 narrow — reliable Facebook publishing is the goal.

## Schema corrections (resolved contradictions in PROJECT.md)

- Publication time lives on `post_publications.published_at` (per-platform). The
  `posts` table must not carry a competing `published_at` (or only as a
  denormalized "first publication" cache).
- `RETRY` is an **action**, not a status. Statuses are the enum in §7.3;
  `CANCELLED`/`ARCHIVED` are terminal states with explicitly defined transitions.
- Single polymorphic create endpoint `POST /api/v1/posts` with a `type` field
  (`BIBLE_VERSE` | `IMAGE`). `POST /api/v1/posts/bible-verse` is an optional alias.
- `caption` is a shared `posts` column for both post types.
- `bible_verse_posts.verse_text` is user-supplied (manual entry in v1).
- `DESIGN_READY` = design generated/previewable (system-set); `APPROVED` = human
  sign-off; `SCHEDULED` = has a `scheduled_at`.

## State machine (enforced by backend)

```text
DRAFT -> READY -> PROCESSING -> DESIGN_READY -> APPROVED -> SCHEDULED -> PUBLISHING -> PUBLISHED
PUBLISHING -> FAILED (retry action) -> PUBLISHING
DRAFT/READY/SCHEDULED/FAILED -> CANCELLED
DRAFT/READY -> ARCHIVED
```

## Internal/n8n API

- Private endpoints under `/api/v1/internal/jobs/*`.
- Signed with HMAC-SHA256 over body + timestamp + request id.
- Headers: `X-Signature`, `X-Timestamp`, `X-Request-Id`.
- Secret shared with n8n via env (`INTERNAL_API_SECRET`).

## Defaults in use (assumed, easy to change)

- Next.js latest stable App Router.
- Retry backoff: 1m / 5m / 30m / manual, max 5 attempts.
- Scheduler interval: 60s (configurable).
- Idempotency key generated by backend, stored on `publishing_jobs`/`post_publications`;
  dedupe on `external_post_id` before publishing.
- Storage provider enum value: `local`.
- Calendar: read-only month view in v1 (drag-and-drop deferred).
- Backup retention: 7 daily / 4 weekly / 3 monthly.

## Open items (do NOT silently decide — verify during implementation)

- Canva Pro design/export workflow (no Autofill) — verify against Canva Connect API.
- Meta Graph API version, OAuth flow, permissions, Page token lifecycle, app review.
- Exact HMAC signing protocol details.
- Proxmox storage mount method (ZFS dataset / dedicated disk / bind mount).
- Bible source is *manual entry* for v1; any future API/licensing is out of scope.

## V1 acceptance scope

End-to-end: login → create Bible-verse or Image+Caption post → select Canva
template → upload/select source image → save → generate design → preview →
approve/schedule → n8n publishes to Facebook via Meta API → record external post
id → view status → retry without duplicate publication.

Everything else in PROJECT.md §18 is explicitly deferred.
