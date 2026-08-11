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

## Revision engine

`revision` holds one counter per scope — the change markers the clients poll through
`GET /sync/rev`. Nothing in the application writes them: the triggers in
`drizzle/0070_revision_triggers.sql` do, so a write moves the marker whichever
process it came from.

To make a new table move an existing scope, add one line to a migration:

```sql
CREATE TRIGGER issue_reaction_rev AFTER INSERT OR UPDATE OR DELETE ON issue_reaction
  FOR EACH ROW EXECUTE FUNCTION rev_issue_child('issue_id', 'detail');
```

`rev_issue_child` takes the column holding the issue id, and `board` or `detail` —
whether the board shows the change or only the issue screen does. Tables that reach
their owner differently get their own function next to the ones in 0070; keep the
order in which they take the scopes (board, then issue, then initiative, and two of
one kind in id order), which is what stops two writers from deadlocking on the
counters.

A new scope kind also needs its entry in `apps/api/src/sync/store.ts` — its name and
the resource a watcher must be allowed to read — and the mirror in
`apps/web/src/utils/revScopes.ts`.

## Conventions

- Explicit snake_case column names (`text("created_at")`) — matches the generated auth schema; no `casing` option.
- FKs use `.references(() => other.id, { onDelete: "cascade" })`.
- `drizzle.config.ts` loads the root `.env` via `dotenv` — needs a valid `DATABASE_URL`.
