# @repo/db

Drizzle ORM + `postgres-js` over PostgreSQL. Single source of truth for the DB schema.
See root `AGENTS.md` for monorepo-wide rules.

## Structure

- `src/client.ts` — the `db` instance (one `postgres()` connection, `prepare: false`).
- `src/schema/auth.ts` — **generated** by better-auth CLI. Do NOT edit by hand;
  regenerate with `bun run auth:generate` (from the auth package / root).
- `src/schema/app.ts` — hand-written application tables. Add domain tables here.
- `src/schema/index.ts` — re-exports every table; `drizzle.config.ts` points at it.
- `src/migrate.ts` — programmatic migrator run on api container startup (no drizzle-kit in prod).
- `drizzle/` — generated SQL migrations (committed).

## Workflow

1. Edit `schema/app.ts` (or regen `schema/auth.ts`).
2. `bun run db:generate` → new SQL in `drizzle/`.
3. `bun run db:migrate`.

Migrations only — never `drizzle-kit push`. Every schema change goes through a
committed migration in `drizzle/`.

## Conventions

- Explicit snake_case column names (`text("created_at")`) — matches the generated auth schema; no `casing` option.
- FKs use `.references(() => other.id, { onDelete: "cascade" })`.
- `drizzle.config.ts` loads the root `.env` via `dotenv` — needs a valid `DATABASE_URL`.
