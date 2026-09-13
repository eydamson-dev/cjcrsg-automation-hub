# Handoff: cjcrsg-automation-hub

Date: 2026-09-13

## Project

Self-hosted Facebook publishing platform. Next.js dashboard, AdonisJS API, Prisma 7,
PostgreSQL, n8n automation, Cloudflare Tunnel. Repo: `git@github.com:eydamson-dev/cjcrsg-automation-hub.git` (branch `main`).

## Where we are

M1, M2, and M3 are done. M1 and M2 are pushed. M3 is **not yet committed**. The next session
picks up at M4 (Next.js dashboard). Read `docs/plan.md` for the M1 through M6 breakdown.
Read `AGENTS.md` for decisions and guardrails. Read `docs/PROJECT.md` for requirements.

## What M3 delivered (based on docs/plan.md)

- Posts CRUD plus lifecycle actions under `/api/v1` (routes in `start/routes.ts`,
  `app/controllers/posts_controller.ts`, logic in `app/services/post_service.ts`):
  - `GET/POST /posts`, `POST /posts/bible-verse` (alias), `GET/PATCH/DELETE /posts/:id`,
    `duplicate`, `design` (transition-only stub), `approve`, `schedule`, `cancel`, `publish`,
    `retry`. All transitions go through `assertTransition`.
  - Edit/delete restricted to DRAFT/READY (delete also CANCELLED). Schedule requires a future
    date. Publish requires a `socialPageId`, sets the post to PUBLISHING and creates a
    `post_publication` (PENDING) plus `publishing_job` (PUBLISH_FACEBOOK, PENDING) with a
    backend-generated idempotency key in one transaction. Retry resets a FAILED publication to
    PENDING with a new job, blocked at `maxAttempts`.
- Assets (`app/controllers/assets_controller.ts`, `app/services/asset_service.ts`):
  upload, list, metadata, `DELETE`, and `GET /assets/:id/content` streaming. Keys are
  `uploads/original/<yyyy>/<mm>/<uuid>.<ext>`, SHA-256 on write, mime allowlist, 20MB cap,
  delete blocked while referenced by a post (409). No raw paths or storage keys exposed.
- Templates (`app/controllers/templates_controller.ts`): admin CRUD under `/canva/templates`,
  `type`/`active` filter, delete blocked while linked to posts.
- Social (`app/controllers/social_accounts_controller.ts`): `POST /social/facebook/connect`
  encrypts tokens at rest via AES-256-GCM (`app/services/token_crypto.ts`, guardrail 8),
  `GET /social/accounts` and `GET /social/pages`. Responses never contain raw tokens.
- Schema correction: added `posts.template_id` (posts had no way to reference a template),
  migration `20260913055834_add_post_template_id`.
- Test suite grew to 49 (posts lifecycle, assets, templates, social, plus M2). Green.

Exit met: full post lifecycle callable over HTTP and validated by schemas. Manually verified
end-to-end (design -> approve -> schedule -> publish) against the dev server.

## What is next: M4

Next.js dashboard (`apps/web`). Details are in `docs/plan.md`. Login, nav, posts list and
filters, type-aware editor, preview plus approve/schedule, read-only calendar, media library.
Dockerfile + compose entry.

## Open items and gotchas

- AdonisJS v7 needs Node 24. Set `fnm use 24` before `pnpm dev:api` or `pnpm test`.
- `pnpm` is installed via `corepack enable pnpm`; the repo pins `pnpm@10.27.0`.
- The compose `api` container still runs the M2 image. Rebuild before testing the container:
  `docker compose up -d --build api`.
- The api container once booted detached from the compose network (empty
  `NetworkSettings.Networks`), giving `P1001 Can't reach postgres`. A
  `docker compose up -d --force-recreate api` reattached it. Check that first if the api
  crash-loops with P1001 while postgres is healthy.
- `@japa/plugin-adonisjs` overrides the api-client `cookie()` macro to sign values. For the
  session cookie in tests use `.plainCookie('sm_session', value)`. Its `.file()` upload path
  needs an `fs.createReadStream` (a `File` or buffer mangles MIME), so tests write temp files
  under `apps/api/tmp/test-uploads`.
- Adonis `MultipartFile` splits MIME into `file.type` + `file.subtype`. Build the full MIME as
  `${file.type}/${file.subtype}` before matching.
- Route groups that need auth must apply both middlewares: `.use([middleware.auth(),
  middleware.role])`. `editor`/`admin` alone do not set `ctx.auth`.
- Dates are accepted as ISO strings and converted in controllers with `app/utils/date.ts`
  (`parseDate`/`optionalDate`). Vine's `vine.date()` rejects valid ISO strings; do not use it
  for datetime inputs.
- The `/design` stub walks DRAFT -> READY -> PROCESSING -> DESIGN_READY. Real design
  generation lands in M5 mocks. `retry` needs a FAILED post, which only the M5 internal n8n
  callbacks set, so retry is not manually reachable yet.
- `FAILED -> editable` is undefined in the docs. The state machine encodes the `AGENTS.md`
  transitions exactly; revisit with M5 if retry exhaustion needs an edit path.
- Canva and Meta are deferred. Build M4 and M5 against mock providers. See `docs/plan.md` and
  `AGENTS.md`.
- Prisma 7 specifics are documented in `AGENTS.md` under "AdonisJS with Prisma". The generated
  client lives in `apps/api/generated/prisma` (gitignored); run `pnpm db:generate` after
  schema changes.

## Suggested skills

- `unslop` for all prose and docs the next agent writes.
- `recall` to rebuild working context from chat history if this handoff is stale.
- `handoff` to produce the next handoff after M4.

## Sensitive info

No credentials or keys are stored in the repo. Secrets live in gitignored `.env` files
(`.env`, `apps/api/.env`, `apps/api/.env.test`). Do not commit `.env`.