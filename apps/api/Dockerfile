FROM node:24-alpine AS build
RUN npm install -g pnpm@10.27.0
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @social-manager/api db:generate
RUN pnpm --filter @social-manager/api build

FROM node:24-alpine AS runtime
RUN npm install -g pnpm@10.27.0
ENV NODE_ENV=production
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
COPY --from=build /repo/apps/api/build ./apps/api/build
EXPOSE 3333
CMD ["sh", "-c", "cd apps/api && pnpm exec prisma migrate deploy && node build/bin/server.js"]
