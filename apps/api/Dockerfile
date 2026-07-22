# ── Elysia API (Bun) — built from the monorepo root ──
# build context in docker-compose = repository root (.)
FROM oven/bun:1.3.14-alpine AS base
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
COPY packages/eslint-config/package.json ./packages/eslint-config/
# --filter api installs only the api workspace and its dependency closure, so the
# image excludes every other app's deps. INSTALL_FLAGS defaults to --production;
# the test gate overrides it to "" so the api suite gets its devDeps (@elysiajs/eden).
ARG INSTALL_FLAGS="--production"
RUN bun install --frozen-lockfile --filter api $INSTALL_FLAGS

# 2) Final image. bun keeps some workspace deps in per-package node_modules
# (packages/db/node_modules, apps/api/node_modules) rather than hoisting them to
# the root, so copy the whole install tree (manifests + every node_modules), then
# overlay the source. .dockerignore excludes node_modules, so `COPY . .` does not
# clobber the copied dependencies.
FROM base AS release
ENV NODE_ENV=production
COPY --from=install /app ./
COPY . .

EXPOSE 3000
# Apply migrations before starting the server.
CMD ["sh", "-c", "bun run packages/db/src/migrate.ts && bun run apps/api/src/index.ts"]
