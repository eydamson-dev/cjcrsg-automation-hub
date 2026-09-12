# Social Manager

Self-hosted Facebook publishing platform. A custom admin dashboard in Next.js,
an application API in AdonisJS, and n8n for automation. Deployed on Proxmox
with Docker and exposed through Cloudflare Tunnel.

`docs/PROJECT.md` holds the requirements. `AGENTS.md` holds the conventions and
open items.

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
cp .env.example .env   # fill in the secrets
docker compose up -d postgres n8n
pnpm dev:api
pnpm dev:web
```
