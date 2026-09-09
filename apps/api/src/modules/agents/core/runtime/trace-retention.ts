import { db, team } from '@repo/db';
import { sql } from 'drizzle-orm';
import { getAgentSettings } from '#modules/settings/service';
import { getLimits } from '#shared/limits';
import { spansTableExists } from './store';

// The sweep that drops old run traces, called by the worker on its own interval.
// How long a team's traces are kept is its own limit when the instance gives it one,
// and the instance setting otherwise; 0 days keeps them.
//
// Only the root span of a trace carries the metadata naming its team (Mastra puts the
// run's metadata on the span that starts the trace), so a window is applied by finding
// the roots past it and deleting every span of their traces. Deleting by trace also
// means a trace is never left half removed.

// Traces deleted per statement. Bounds how long one delete holds its locks; a sweep
// keeps going until the batch comes back short.
const BATCH = 200;
// Batches one sweep runs per window before it leaves the rest to the next one.
const MAX_BATCHES = 50;

async function deleteBatch(where: ReturnType<typeof sql>): Promise<number> {
  const res = await db.execute(sql`
    DELETE FROM mastra_ai_spans
    WHERE "traceId" IN (
      SELECT "traceId" FROM mastra_ai_spans
      WHERE "parentSpanId" IS NULL AND ${where}
      LIMIT ${BATCH}
    )
  `);
  return (res as unknown as { count?: number }).count ?? 0;
}

async function deleteUntilDone(where: ReturnType<typeof sql>): Promise<number> {
  let deleted = 0;
  for (let batch = 0; batch < MAX_BATCHES; batch++) {
    const rows = await deleteBatch(where);
    deleted += rows;
    if (rows === 0) break;
  }
  return deleted;
}

// The team id a trace carries, as an integer. The metadata is written by the runtime,
// but it is a jsonb value like any other, so a value that is not a number is left for
// the orphan sweep rather than cast.
const traceTeamId = sql`(CASE WHEN metadata->>'teamId' ~ '^[0-9]+$' THEN (metadata->>'teamId')::int END)`;

// Deletes every trace past the window that applies to its team, and every trace whose
// team is gone. Returns how many spans it removed.
export async function pruneAgentTraces(): Promise<number> {
  if (!(await spansTableExists())) return 0;
  const { traceRetentionDays } = await getAgentSettings();
  const teams = await db.select({ id: team.id }).from(team);

  // ponytail: one pass per team, which is what a self-hosted instance and the teams of
  // one hosted shard cost; a shard with thousands would want the windows read in bulk.
  let deleted = 0;
  for (const { id } of teams) {
    const { maxTraceRetentionDays } = await getLimits({ teamId: id });
    const days = maxTraceRetentionDays || traceRetentionDays;
    if (days <= 0) continue;
    deleted += await deleteUntilDone(
      sql`${traceTeamId} = ${id} AND "startedAtZ" < now() - make_interval(days => ${days})`,
    );
  }

  // A deleted team takes its agents and its runs with it, but Mastra's spans carry no
  // foreign keys of ours, so its traces are left behind for this.
  deleted += await deleteUntilDone(
    sql`${traceTeamId} IS NULL OR ${traceTeamId} NOT IN (SELECT id FROM ${team})`,
  );
  return deleted;
}
