# @repo/db

Drizzle ORM + `postgres-js` over PostgreSQL. The source of truth for the DB schema.

## Structure

- `src/schema/auth.ts` is **generated** by better-auth. Do not edit it; run `bun run auth:generate`.
- `src/schema/app.ts`: hand-written application tables. Add domain tables here.
- `src/schema/scim.ts`: hand-written SCIM tables.
- `drizzle.config.ts` reads only `src/schema/index.ts`. Export a new schema file from it.
- `src/permissions.ts`: the permission matrix stored in `team_role.permissions`.
- `src/settings.ts` / `src/secrets.ts`: instance config, `app_setting` in plaintext jsonb,
  `app_secret` encrypted with `APP_ENCRYPTION_KEY`.
- `src/domains/`: a new config that several processes read gets a module here: shape, defaults and
  a reader that decrypts it if it is encrypted. A config only one process reads stays out. The
  caller keeps writes and validation. `storage.ts` also holds the upload check and quota queries.
- `src/migrate.ts`: programmatic migrator, no drizzle-kit in prod.

## Workflow

1. Edit `schema/app.ts` or `schema/scim.ts`, or regenerate `schema/auth.ts`.
2. `bun run db:generate`, which writes SQL to `drizzle/`.
3. `bun run db:migrate`, then `bun run db:migrate:test` for the test DB.

Never `drizzle-kit push`. Every schema change goes through a committed migration.

## Conventions

- Explicit snake_case column names (`text("created_at")`). No `casing` option.
- New FK: `onDelete: "cascade"` if the row cannot exist without its parent, `onDelete: "set null"`
  for an optional link (assignee, author, cycle, parent issue). Keep `cascade` on a nullable FK when
  NULL has its own meaning (system role, public board) or a CHECK needs the owner.
- Agents are enumerated through `ai_agent`; `user` has no non-human flag. See `docs/dev/agents.md`.

## Revision triggers

Triggers write `revision`; application code leaves it alone. The one exception is `appendRunEvents`,
which calls `bump_rev` because `agent_run_trace` has no trigger.

To make a table move an existing scope, add one line to a migration:

```sql
CREATE TRIGGER issue_cycle_rev AFTER INSERT OR UPDATE OR DELETE ON issue_cycle
  FOR EACH ROW EXECUTE FUNCTION rev_issue_child('issue_id', 'detail');
```

For a new table, append the line to the SQL that `db:generate` writes. For an existing table
`db:generate` writes nothing, so run `bunx drizzle-kit generate --custom --name=<name>` in
`packages/db`: the migrator runs only files listed in the journal.

`rev_issue_child` takes the column holding the issue id, and `board` or `detail`. Both move the
issue and its initiative; `board` also moves the board. Any other value acts as `detail`. Tables
owned by an initiative use `rev_initiative_child('initiative_id')`, and tables with a `document_id`
column use `rev_document_child()`.

A table that reaches its owner another way gets its own function in a new migration, modelled on
`rev_checklist_item` in `0070_revision_triggers.sql`. A later migration can replace a function: the
current `rev_issue` is in `0142_issue_key_alias.sql`.

Inside a function, keep the lock order: board, then issue, then initiative, two of one kind in id
order, with `documents` before issue and initiative. It stops two single-row writes from
deadlocking. `inbox` and `runner-queue` are outside the order: each is taken alone.

A new scope kind also needs its entry in `scopeKind` in `apps/api/src/modules/sync/service.ts`, its
name in `apps/api/src/modules/sync/model.ts` and the mirror in `apps/web/src/utils/revScopes.ts`. A
scope across projects has no `scopeKind` entry: `apps/api/src/modules/sync/index.ts` handles it.
