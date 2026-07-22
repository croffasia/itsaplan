# ── Webhook delivery worker (Bun) — built from the monorepo root ──
# build context in docker-compose = repository root (.)
FROM oven/bun:1.3.14-alpine AS base
WORKDIR /app

# 1) Install dependencies from manifests (cacheable layer). All workspace
# manifests are copied — `bun install --frozen-lockfile` validates the whole
# workspace against bun.lock, so a missing member fails the install.
FROM base AS install
COPY package.json bun.lock ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY apps/worker/package.json ./apps/worker/
COPY apps/bot/package.json ./apps/bot/
COPY packages/db/package.json ./packages/db/
COPY packages/auth/package.json ./packages/auth/
COPY packages/agent-tools/package.json ./packages/agent-tools/
COPY packages/crypto/package.json ./packages/crypto/
COPY packages/mailer/package.json ./packages/mailer/
COPY packages/eslint-config/package.json ./packages/eslint-config/
# --filter worker installs only the worker workspace and its dependency closure.
# INSTALL_FLAGS defaults to --production; the test gate overrides it to "".
ARG INSTALL_FLAGS="--production"
RUN bun install --frozen-lockfile --filter worker $INSTALL_FLAGS

# 2) Final image. Copy the whole install tree (manifests + every node_modules),
# then overlay the source. .dockerignore excludes node_modules, so `COPY . .`
# does not clobber the copied dependencies.
FROM base AS release
ENV NODE_ENV=production
COPY --from=install /app ./
COPY . .

# The api applies migrations on startup; the worker only reads/writes existing
# tables. It polls the delivery queue, so it tolerates the tables not existing yet
# (a tick logs the error and retries on the next interval).
CMD ["bun", "run", "apps/worker/src/index.ts"]
