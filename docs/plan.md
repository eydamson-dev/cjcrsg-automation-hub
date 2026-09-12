# Implementation Plan

MVP build plan for the self-hosted Facebook publishing platform. Requirements
live in `docs/PROJECT.md`. Decisions and guardrails live in `AGENTS.md`.

## Confirmed scope

- No real Canva or Meta integration in the MVP. Providers are mocks, wired
  behind the service abstractions.
- Full state machine against mocks is the bar: `DRAFT` through `PUBLISHED`
  runs end-to-end, including n8n publishing jobs and idempotent retry, with
  fake Canva output and a fake Facebook `external_post_id`.
- Deployment is wired early. Dockerfiles and compose land with each app, not
  as a final step.

## Milestones

### M1 - Foundation + containerized dev loop

- Scaffold AdonisJS v6 with the slim kit. No Lucid, no `@adonisjs/auth`.
  Add Prisma by hand.
- Full `schema.prisma` for all section 7 tables, with the schema corrections
  baked in. First migration.
- `apps/api` Dockerfile. Extend `docker-compose.yml` so `api` runs against
  `postgres` for dev. `pnpm dev:api` still works natively.

Exit: `docker compose up api` boots and migrates cleanly.

### M2 - Auth, RBAC, state machine, storage

- Hand-rolled sessions on the `sessions` table via Prisma. Session id in an
  HttpOnly/SameSite/Secure cookie. Argon2id via `@node-rs/argon2`.
- `ADMIN` and `EDITOR` middleware.
- State-machine module that rejects invalid transitions.
- `FilesystemStorage` plus the `StorageService` interface. Audit log helper.

Exit: login/logout/me against Postgres. Transition guard covered by tests.

### M3 - Core API

- Posts CRUD with a polymorphic `type` field, plus `approve`, `schedule`,
  `cancel`, `publish`, `retry`, `duplicate`.
- Assets upload and `/assets/:id/content` streaming, with no raw paths exposed.
- Templates and social accounts/pages, with tokens encrypted at rest.

Exit: full post lifecycle callable over HTTP and validated by schemas.

### M4 - Next.js dashboard + containerized

- Login, nav, posts list and filters, type-aware editor, preview plus
  approve/schedule, read-only calendar, media library.
- `apps/web` Dockerfile. Add `web` to compose.

Exit: manual create, save, approve, schedule flow works against the API,
containerized.

### M5 - n8n + internal API + mock providers

- HMAC-signed internal endpoints under `/internal/jobs/*`.
- Mock Canva and mock Facebook providers.
- n8n workflows: design generation, publish, scheduler (60s), retry.
- Idempotency key and dedupe on `external_post_id`.

Exit: `DRAFT` through `PUBLISHED` end-to-end against mocks. Retry produces no
duplicate.

### M6 - Ops + release

- Health checks, job and publication history, backup jobs, `cloudflared`
  service for web and n8n.

## Deferred

- Real Canva Connect API. Canva Pro design and export without Autofill.
  Spike first.
- Real Meta Graph API. Version, permissions, OAuth, app review. Spike first.
- Everything in `PROJECT.md` section 18.

## Risks

- Canva Pro design flow and Meta Graph API details are unverified. Mocks
  isolate this risk. Nothing in M1 through M6 depends on them.
- AdonisJS with Prisma means hand-wired auth. Budget M2 for the session layer.
- The n8n to API contract needs a precise payload spec. Define it in M5 before
  building the workflows.

## Retry policy

1 minute, 5 minutes, 30 minutes, then manual. At most 5 attempts.

## Defaults

- Scheduler runs every 60 seconds.
- Storage provider enum value `local`.
- Calendar is a read-only month view. Drag-and-drop is deferred.
- Backup retention: 7 daily, 4 weekly, 3 monthly.
