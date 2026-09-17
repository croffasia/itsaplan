# @repo/db

Drizzle ORM + `postgres-js` over PostgreSQL. Single source of truth for the DB schema.
See root `AGENTS.md` for monorepo-wide rules.

## Structure

- `src/client.ts` — the `db` instance (one `postgres()` connection, `prepare: false`).
- `src/schema/auth.ts` — **generated** by better-auth CLI. Do NOT edit by hand;
  regenerate with `bun run auth:generate` (from the auth package / root).
- `src/schema/app.ts` — hand-written application tables. Add domain tables here.
- `src/schema/index.ts` — re-exports every table; `drizzle.config.ts` points at it.
- `src/permissions.ts` — the permission matrix stored in `team_role.permissions`: the
  resource/action catalog, the default member role, and the normalizer. It lives here
  because the API and the sign-up hook in `@repo/auth` both write it.
- `src/settings.ts` / `src/secrets.ts` — the two instance config stores: `app_setting`
  in plaintext jsonb, `app_secret` encrypted with `APP_ENCRYPTION_KEY`. Both are read
  by more than one app, which is why they are here.
- `src/domains/` — one module per stored config that more than one process reads: its
  shape, its defaults and the reader that decrypts it. Only that. The write side, the
  redacted view an HTTP client gets, the validation and anything else specific to one
  caller stay with that caller — the api's settings routes, or god mode in
  `@repo/auth`. A config only one process reads does not belong here at all.
  Currently: the instance Telegram bot (api, bot, worker), the instance mail provider
  (`@repo/auth`, api, worker), and a team's notification providers (api, worker).
- `src/migrate.ts` — programmatic migrator run on api container startup (no drizzle-kit in prod).
- `drizzle/` — generated SQL migrations (committed).

## Workflow

1. Edit `schema/app.ts` (or regen `schema/auth.ts`).
2. `bun run db:generate` → new SQL in `drizzle/`.
3. `bun run db:migrate`.

Migrations only — never `drizzle-kit push`. Every schema change goes through a
committed migration in `drizzle/`.

## Team-owned agents

An AI agent is a row in `ai_agent` with a `team_id` and a `user_id`: the team that owns
it, and the bot user it acts as. The team is the boundary — there is no instance-level
agent and no flag on `user` marking a non-human identity, so anything that has to
enumerate agents does it through `ai_agent`.

What the team owns with it: `agent_skill`, `agent_tool` and `integration_credential`
all carry a `team_id` and are shared by every project of the team. `agent_schedule` and
`agent_run` carry a `project_id` — a run happens in one project.

The projects an agent works in are its bot user's `project_member` rows, the same as for
a person, and the `role_id` on each of them is what its requests are checked against —
per project, so one agent can hold different roles in two of them. Its rights in a
project are the intersection of that role and the actions in `ai_agent.tools`.
`team_member.role` takes a fourth value, `'agent'`, so an agent stands in the team
without being a person in it.

`ai_agent_team_username_uq` makes the mention handle unique per team, not per project.

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
