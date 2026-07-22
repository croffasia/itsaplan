# ── Next.js (standalone) — built from the monorepo root ──
# build context in docker-compose = repository root (.)
FROM oven/bun:1.3.9-alpine AS base
WORKDIR /app

# 1) Install dependencies from manifests (cacheable layer). All workspace
# manifests are copied — `bun install --frozen-lockfile` validates the whole
# workspace against bun.lock, so a missing member (e.g. api) fails the install.
FROM base AS install
COPY package.json bun.lock ./
COPY apps/web/package.json ./apps/web/
COPY apps/api/package.json ./apps/api/
COPY apps/worker/package.json ./apps/worker/
COPY apps/bot/package.json ./apps/bot/
COPY packages/db/package.json ./packages/db/
COPY packages/auth/package.json ./packages/auth/
COPY packages/agent-tools/package.json ./packages/agent-tools/
COPY packages/crypto/package.json ./packages/crypto/
COPY packages/mailer/package.json ./packages/mailer/
COPY packages/eslint-config/package.json ./packages/eslint-config/
RUN bun install --frozen-lockfile

# 2) Build Next. bun keeps some workspace deps in per-package node_modules rather
# than hoisting them to the root, so copy the whole install tree (manifests +
# every node_modules), then overlay the source. .dockerignore excludes
# node_modules, so `COPY . .` does not clobber the copied dependencies.
FROM base AS build
COPY --from=install /app ./
COPY . .
# NEXT_PUBLIC_* are inlined into the bundle at build time — pass them as build args.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_PRIVACY_URL
ENV NEXT_PUBLIC_PRIVACY_URL=$NEXT_PUBLIC_PRIVACY_URL
ARG NEXT_PUBLIC_TERMS_URL
ENV NEXT_PUBLIC_TERMS_URL=$NEXT_PUBLIC_TERMS_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN cd apps/web && bun run build

# 3) Minimal final image (standalone output).
FROM base AS release
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public

EXPOSE 3001
CMD ["bun", "apps/web/server.js"]
