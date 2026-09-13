# Social Manager

Self-hosted Facebook publishing platform. A custom Next.js admin dashboard, an
AdonisJS API, PostgreSQL, and n8n for automation. Posts go DRAFT to PUBLISHED
through a state machine, design is generated against Canva templates, and n8n
publishes to Facebook with idempotent retries. Deployed on your own hardware
with Docker and exposed through Cloudflare Tunnel.

Current status: milestones M1 through M4 are built. Auth, the full post API,
and the dashboard work end-to-end. Publishing execution and design generation
are wired against mocks in M5. See `docs/plan.md` and `docs/handoff.md`.

## What it does

- Create Bible-verse and image posts with a caption.
- Pick a Canva template and generate a design.
- Preview, approve, schedule, cancel, publish, and retry posts.
- Track publication status and publishing jobs.
- Upload and manage media, streamed through the API (no raw paths exposed).
- Manage templates and connect Facebook accounts (tokens encrypted at rest).
- Read-only calendar of scheduled posts.

Roles: `ADMIN` manages users, integrations, templates, and posts. `EDITOR`
creates, edits, schedules, and publishes posts.

## Architecture

```text
browser ──> Next.js dashboard ──proxy /api/*──> AdonisJS API ──> PostgreSQL 16
                                                    │   │
                                                    │   └─> local filesystem (media)
                                                    └─ calls ─> n8n (automation)
```

- The dashboard never talks to external providers. It proxies `/api/*` to the
  API, so the session cookie stays same-origin.
- The API owns auth, authorization, business rules, post state transitions,
  and asset metadata. It is the single source of truth for posts.
- n8n only executes automation: design generation, Facebook publishing,
  scheduling, retries. It never holds application data.
- Media lives on the local filesystem under `/data/social-manager`; Postgres
  stores only metadata and storage keys.

## Requirements

- Node.js 24 (AdonisJS v7 requires it). The repo uses `fnm`; run
  `fnm use 24` before any `pnpm` command.
- pnpm 10, enabled with `corepack enable pnpm`.
- Docker Engine with Compose v2 for PostgreSQL (and later n8n).
- A PostgreSQL 16 database (the repo provides one via Docker).
- Optional for production: a Cloudflare account and Tunnel to expose web and
  n8n. Not needed for local development.

## Local setup

```bash
fnm use 24
corepack enable pnpm
pnpm install
```

### Environment files

Copy the three example files and fill them in. None of them are committed.

```bash
cp .env.example .env                      # Docker Compose and containers
cp apps/api/.env.example apps/api/.env    # API dev server
cp apps/web/.env.example apps/web/.env.local  # web dev server
```

Required values:

| File | Variable | Meaning |
| --- | --- | --- |
| `.env` | `APP_KEY` | Encryption key. Generate: `node -e "console.log('base64:'+require('crypto').randomBytes(32).toString('base64'))"` |
| `.env` | `POSTGRES_PASSWORD` | Postgres password (also used in the DATABASE_URLs) |
| `.env` | `N8N_ENCRYPTION_KEY` | n8n's key; any long random string |
| `.env` / `apps/api/.env` | `DATABASE_URL` | Point both at the same Postgres instance, e.g. `postgresql://social_manager:change-me@localhost:5432/cjcrsg_social_manager?schema=public` |
| `apps/api/.env` | `APP_KEY` | Same value as the root `.env` `APP_KEY` |
| `apps/api/.env` | `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | Credentials for `pnpm db:seed` |
| `apps/web/.env.local` | `API_URL` | `http://localhost:3333` in dev; `http://api:3333` inside Docker |

### Start the database

```bash
docker compose up -d postgres
```

### Migrate and seed the admin

```bash
pnpm db:migrate      # applies prisma migrations
pnpm db:seed         # upserts the admin from SEED_ADMIN_*
```

### Run the API

```bash
pnpm dev:api
```

The API runs on `http://localhost:3333`. Check it:

```bash
curl http://localhost:3333/health        # {"status":"ok"}
```

### Run the dashboard

```bash
pnpm dev:web
```

Open `http://localhost:3000` and sign in with the seeded admin. Manual flow:
create a Bible-verse post, pick a template, generate a design, approve,
schedule, and see it on the calendar.

## Containerized setup

```bash
docker compose up -d --build api web
# seed the initial admin (production images require the explicit opt-out)
docker compose exec -e SEED_ALLOWED=true api node apps/api/build/bin/console.js db:seed
```

Open `http://localhost:3000`. The `web` image bakes the API origin at build
time via the `API_URL` build arg; Compose already passes it.

## Running tests

The API tests run against a dedicated database.

```bash
# one-time: create the test database
docker compose exec postgres psql -U social_manager -d postgres \
  -c "CREATE DATABASE cjcrsg_social_manager_test"

cp apps/api/.env.example apps/api/.env.test
# set DATABASE_URL in .env.test to the test database

pnpm test
```

The test runner migrates and truncates the test database automatically.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm dev:api` | Run the AdonisJS API |
| `pnpm dev:web` | Run the Next.js dashboard |
| `pnpm db:migrate` | Apply Prisma migrations |
| `pnpm db:migrate:dev` | Create migrations from schema changes |
| `pnpm db:seed` | Upsert the admin from `SEED_ADMIN_*` |
| `pnpm test` | API tests (needs `apps/api/.env.test`) |
| `pnpm -r lint` | Lint all packages |
| `pnpm -r typecheck` | Typecheck all packages |
| `pnpm -r build` | Build all packages and apps |

## Repository layout

```text
apps/web          Next.js admin dashboard
apps/api          AdonisJS application API
packages/types    shared TypeScript types
packages/validation shared validation schemas
packages/config   shared runtime configuration
infrastructure/   docker, postgres
n8n/workflows     n8n workflow definitions
docs/             requirements, plan, handoff, deployment notes
```

## Documentation

- `docs/PROJECT.md` is the requirements baseline and source of truth.
- `docs/plan.md` is the MVP build plan (milestones M1 to M6).
- `docs/handoff.md` is the current state and what is next.
- `AGENTS.md` holds build decisions, guardrails, and conventions.