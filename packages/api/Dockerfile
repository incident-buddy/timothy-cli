FROM node:22-slim AS builder
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/api/package.json ./packages/api/
RUN pnpm install --filter @timothy/api --frozen-lockfile
COPY packages/api/ ./packages/api/
RUN pnpm --filter @timothy/api build
RUN pnpm deploy --filter @timothy/api --prod --legacy /app/deploy && \
    rm -rf /app/deploy/src /app/deploy/scripts

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/deploy .
EXPOSE 8080
CMD ["node", "dist/server.js"]
