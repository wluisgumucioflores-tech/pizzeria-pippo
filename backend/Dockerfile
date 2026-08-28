# Build context MUST be the monorepo root (backend depends on the
# @pippo/shared workspace package), e.g.:
#   docker build -f backend/Dockerfile -t pippo-backend .

# ---- Stage 1: install deps (with dev) + build ----
FROM node:20-alpine AS builder
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app

# Copy every workspace's package.json first (npm workspaces + package-lock.json
# need the full set to resolve) so this layer only re-runs when deps change.
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY backend/prisma.config.ts backend/prisma.config.ts
COPY backend/prisma backend/prisma
COPY packages/shared/package.json packages/shared/package.json
COPY services/mcp-saas/package.json services/mcp-saas/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci

COPY packages/shared packages/shared
COPY backend backend

# `prisma generate` runs as part of backend's postinstall/build and needs
# *a* DATABASE_URL to resolve — it never connects, so a placeholder is fine.
# The real value is injected at `docker run` time, never baked into the image.
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/postgres"

RUN npm run build --workspace=@pippo/shared
RUN npm run build --workspace=backend

# ---- Stage 2: production-only node_modules (no devDependencies) ----
FROM node:20-alpine AS deps-prod
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY backend/prisma.config.ts backend/prisma.config.ts
COPY backend/prisma backend/prisma
COPY packages/shared/package.json packages/shared/package.json
COPY services/mcp-saas/package.json services/mcp-saas/package.json
COPY frontend/package.json frontend/package.json

ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/postgres"
RUN npm ci --omit=dev

# ---- Stage 3: runtime ----
FROM node:20-alpine AS runtime
RUN apk add --no-cache openssl
ENV NODE_ENV=production
WORKDIR /app

COPY --from=deps-prod /app/node_modules ./node_modules
COPY --from=deps-prod /app/package.json ./package.json
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/package.json ./backend/package.json

WORKDIR /app/backend
EXPOSE 3333
# nest build's inferred rootDir spans both backend/src and backend/prisma.config.ts,
# so the compiled entrypoint lands at dist/src/main.js — NOT dist/main.js like the
# (stale) "start:prod" script in package.json assumes.
CMD ["node", "dist/src/main"]
