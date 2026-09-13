# syntax=docker/dockerfile:1

FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /workspace

ARG API_URL=http://localhost:3333
ENV API_URL=$API_URL

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY tsconfig.base.json ./
COPY apps/web ./apps/web
RUN pnpm install --filter @social-manager/web... --filter @social-manager/web
RUN pnpm --filter @social-manager/web build

FROM node:24-alpine AS runner
RUN corepack enable
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

COPY --from=build --chown=node:node /workspace/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /workspace/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /workspace/apps/web/public ./apps/web/public

USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]