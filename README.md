# Social Manager

Self-hosted Facebook publishing platform: a custom admin dashboard (Next.js) + an
application API (AdonisJS) + n8n automation, deployed on Proxmox via Docker and
exposed through Cloudflare Tunnel.

See `docs/PROJECT.md` for the full requirements baseline and `AGENTS.md` for the
decided conventions and open items.

## Layout

```text
apps/web          Next.js admin dashboard
apps/api          AdonisJS application API
packages/types    shared TypeScript types
packages/validation shared validation schemas
packages/config   shared runtime configuration
infrastructure/   docker, postgres
n8n/workflows     n8n workflow definitions
docs/             architecture, database, api, deployment notes
```

## Quick start

```bash
pnpm install
cp .env.example .env   # then fill in secrets
docker compose up -d postgres n8n
pnpm dev:api
pnpm dev:web
```
