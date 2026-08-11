# The revision engine

Two people have the same board open. One of them drags a card to another column. The other one
sees it move a few seconds later, without touching anything.

That is what this engine does. Every screen that has to stay current watches a **scope**, the
engine keeps a counter per scope, and the screen refetches its data when its counter changes.

## Walking through one change

Say someone renames issue 450, which lives in project 12.

1. The API updates the row. A trigger on the `issue` table runs and increments two counters in
   the `revision` table: `board:12` and `issue:450`.
2. Meanwhile every open tab asks the API, every 8 seconds, for the counters it cares about:

   ```
   GET /sync/rev?scopes=board:12,issue:450,inbox:12
   { "revs": { "board:12": "38", "issue:450": "13", "inbox:12": "5" } }
   ```

3. A tab showing the board had `board:12` at `37`, now reads `38`, and refetches the board
   issues. A tab with issue 450 open refetches the issue and its comments. A tab looking at a
   different project asked for none of this and refetches nothing.

The counter has no meaning beyond "different from last time". Clients compare it for equality
and never do arithmetic on it, so gaps in the numbers are harmless.

## Scopes

| Scope                        | Watched by                    | Moves when                                                        |
| ---------------------------- | ----------------------------- | ----------------------------------------------------------------- |
| `board:<projectId>`          | the work items board          | any issue, label, relation, initiative or cycle in the project changes |
| `issue:<issueId>`            | the issue screen              | the issue, its comments, checklists, attachments or field values change |
| `initiative:<initiativeId>`  | the initiative screen         | the initiative or any issue inside it changes                     |
| `inbox:<projectId>:<userId>` | the inbox and the badge       | that user gets a notification, reads one, or deletes one          |

Comments deliberately do not move the board: the board does not show them, so refetching it
would be wasted work.

The inbox is the one scope that belongs to a person rather than an entity. Clients ask for
`inbox:12` and the API fills in the session user, so one person can never watch another's inbox.

## Where the code lives

| File                                   | What it holds                                            |
| -------------------------------------- | -------------------------------------------------------- |
| `packages/db/drizzle/0070_*.sql`       | `bump_rev`, the trigger functions, and their triggers    |
| `apps/api/src/sync/store.ts`           | the scope names and the read query                       |
| `apps/api/src/sync/routes.ts`          | `GET /sync/rev`                                          |
| `apps/web/src/context/syncContext.tsx` | the one poll every screen shares                         |
| `apps/web/src/hooks/useLiveRefresh.ts` | what a screen calls                                      |
| `apps/web/src/utils/revScopes.ts`      | the scope names on the client                            |

Nothing in the application writes a counter. The triggers do, which means a write from the
worker, the bot, an MCP tool or a hand-typed `UPDATE` in psql moves the marker as surely as a
write from the API.

## Using it in a screen

```ts
useLiveRefresh({
  scope: revScope.issue(issueId),
  targets: [qk.issue(issueId), qk.feed(issueId)],
});
```

That is the whole integration. No screen runs its own timer: `SyncProvider` collects the scopes
of everything currently mounted, asks for them in one request, and invalidates the targets of
the scopes that moved. The poll stops while the tab sits in the background, and while nothing is
registered.

## Reading the counters

```sql
select r.scope, r.rev, m.role, pr.permissions
from revision r
join project_member m on m.project_id = r.project_id and m.user_id = $userId
left join project_role pr on pr.id = m.role_id
where r.scope = any($scopes)
```

The join is also the access check. Ask for a project you are not a member of and no row comes
back, so the answer is `"0"`, exactly what a scope that has never changed returns. The role
decides the rest: each scope kind names a resource (`work_items` for the board and an issue,
`initiatives` for an initiative), and a member whose role may not read it gets the same `"0"`.
The inbox names no resource — it is the caller's own.

A new scope therefore needs a correct `project_id` on the row and the resource its watchers must
be allowed to read.

## Adding a table to an existing scope

One line in a migration. Say reactions on issues get their own table:

```sql
CREATE TRIGGER issue_reaction_rev AFTER INSERT OR UPDATE OR DELETE ON issue_reaction
  FOR EACH ROW EXECUTE FUNCTION rev_issue_child('issue_id', 'detail');
```

The first argument is the column holding the issue id. The second says who shows the change:
`board` if the board does, `detail` if only the issue screen does. The issue screen already
watches `issue:<id>`, so reactions start arriving with no client change at all.

A table that reaches its owner through another table needs its own function next to the ones in
the migration. `rev_checklist_item()` is the example to copy: it goes from
`issue_checklist_item` to `issue_checklist` to `issue`.

## Adding a new scope

A new kind of scope touches two more places: the entry in `scopeKind` in
`apps/api/src/sync/store.ts`, which names it, makes the API accept it, and says which resource a
watcher must be allowed to read, and the mirror in `apps/web/src/utils/revScopes.ts`.
`packages/db/AGENTS.md` keeps the same recipe next to the schema.

## Four rules before you touch the triggers

**Take the scopes in one order everywhere: board, then issue, then initiative.** Opposite orders
deadlock. Two counters of the same kind — the initiatives an issue moved between — go in id
order, for the same reason.

**`revision.project_id` has no foreign key on purpose.** Deleting a project cascades into its
issues, and each of those deletes inserts a counter row for a project on its way out — a foreign
key would abort the delete. A deferred constraint trigger on `project` removes the leftovers at
commit, after the cascades.

**A child trigger does nothing when its issue is already gone.** Its rows cascade away after the
issue and can no longer resolve a project; the issue's own delete already moved the board counter
and dropped `issue:<id>`.

**Bulk writes bump a counter many times, and that is fine.** Nobody reads the value, only the
change.

## Why it works this way

**A counter, not a log of changes.** The client only needs to know that something changed.
Answering "what changed since revision X" would mean commit-ordering guarantees (`xid8` with
`pg_snapshot_xmin`), soft deletes, and patch application in the browser. The marker is opaque, so
that can still be added later.

**Triggers, not calls from the application.** A counter cannot be forgotten in a new code path,
and writes that never pass through the API still move it.

**Polling, not a push stream.** `NOTIFY` takes a lock on every commit that carries one, which
serializes all transactions on the instance; it stops working behind PgBouncer in transaction
pooling mode, and drops notifications on a broken connection, so a poll would be needed anyway.
One small request per tab every 8 seconds is cheap enough.
