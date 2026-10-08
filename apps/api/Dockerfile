# ── Elysia API (Bun) — built from the monorepo root ──
# build context in docker-compose = repository root (.)
FROM oven/bun:1.4.0-alpine AS base
WORKDIR /app

# 1) Install dependencies from manifests (cacheable layer). All workspace
# manifests are copied — `bun install --frozen-lockfile` validates the whole
# workspace against bun.lock, so a missing member (e.g. web) fails the install.
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
COPY packages/net/package.json ./packages/net/
COPY packages/storage/package.json ./packages/storage/
COPY packages/runner/package.json ./packages/runner/
COPY packages/eslint-config/package.json ./packages/eslint-config/
# INSTALL_FILTER installs only the api workspace and its dependency closure, so the
# image excludes every other app's deps. INSTALL_FLAGS defaults to --production; the
# test gate overrides both — it runs the bot and worker suites out of this image, and
# those need their own workspace links and the devDeps the suites import.
ARG INSTALL_FILTER="--filter api"
ARG INSTALL_FLAGS="--production"
RUN bun install --frozen-lockfile $INSTALL_FILTER $INSTALL_FLAGS

# 2) Final image. bun keeps some workspace deps in per-package node_modules
# (packages/db/node_modules, apps/api/node_modules) rather than hoisting them to
# the root, so copy the whole install tree (manifests + every node_modules), then
# overlay the source. .dockerignore excludes node_modules, so `COPY . .` does not
# clobber the copied dependencies.
#
# pg_dump, for the backup migrate.ts takes before it applies anything, refuses a server
# newer than itself. The Railway template runs Postgres 18 and the compose files run 17,
# so the image ships the 18 client, which dumps both. The bun image is built on Alpine
# 3.22, which has no 18 client, so this stage is Alpine 3.23 with bun copied in.
FROM alpine:3.23 AS release
WORKDIR /app
ENV NODE_ENV=production
ENV BUN_RUNTIME_TRANSPILER_CACHE_PATH=0
RUN apk add --no-cache libgcc libstdc++ postgresql18-client
COPY --from=base /usr/local/bin/bun /usr/local/bin/
COPY --from=install /app ./
COPY . .

EXPOSE 3000
# Apply migrations before starting the server.
CMD ["sh", "-c", "bun run packages/db/src/migrate.ts && bun run apps/api/src/index.ts"]
