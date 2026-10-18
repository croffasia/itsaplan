---
name: itsaplan-drizzle-migrations
description: Use when Drizzle db:generate or a migration rename.
category: backend
---

# itsaplan Drizzle migrations

After a schema change in `packages/db/src/schema`, run `bun run db:generate` from the repo root. It writes `packages/db/drizzle/NNNN_<random_words>.sql`. Rename the file to a descriptive tag in the same step, and update the matching `tag` in `packages/db/drizzle/meta/_journal.json`. The snapshot file keeps its index and does not change.

1. `bun run db:generate`, then read the new SQL.
2. `cd packages/db/drizzle && mv NNNN_<random>.sql NNNN_<descriptive>.sql`, then `perl -pi -e 's/NNNN_<random>/NNNN_<descriptive>/' meta/_journal.json`.
3. `grep -c <descriptive> meta/_journal.json` must print 1.
4. From the repo root: `bun run db:migrate:test`, then `bun run db:migrate`. Both must report success before the work is called done.

Bash writes to a file count as changes to files already read. Read the file again before any Edit on it.
