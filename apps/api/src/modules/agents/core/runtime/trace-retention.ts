import { db, team } from '@repo/db';
import { sql, type SQL } from 'drizzle-orm';
import { getAgentSettings } from '#modules/settings/service';
import { spansTableExists } from './store';

// The sweep that drops old run traces, run by the api's background loop. The window is
// the instance setting; 0 days keeps every trace.
//
// A window applies to a run, not to each of its spans: the sweep finds the root spans
// past it and deletes every span of their traces, so a trace is never left half removed.

// Traces deleted per statement, which bounds how long one delete holds its locks.
const BATCH = 200;
// Batches one sweep runs per condition before it leaves the rest to the next one.
const MAX_BATCHES = 50;

async function deleteBatch(where: SQL): Promise<number> {
  const res = await db.execute(sql`
    DELETE FROM mastra_ai_spans
    WHERE "traceId" IN (
      SELECT "traceId" FROM mastra_ai_spans
      WHERE "parentSpanId" IS NULL AND (${where})
      LIMIT ${BATCH}
    )
  `);
  return (res as unknown as { count?: number }).count ?? 0;
}

async function deleteUntilDone(where: SQL): Promise<number> {
  let deleted = 0;
  for (let batch = 0; batch < MAX_BATCHES; batch++) {
    const rows = await deleteBatch(where);
    deleted += rows;
    if (rows === 0) break;
  }
  return deleted;
}

// The team id a trace carries, as an integer. The metadata is a jsonb value like any
// other, so a value that is not a number is left for the orphan sweep rather than cast.
const traceTeamId = sql`(CASE WHEN metadata->>'teamId' ~ '^[0-9]+$' THEN (metadata->>'teamId')::int END)`;

// Deletes every trace past the window and every trace whose team is gone. Returns how
// many spans it removed.
export async function pruneAgentTraces(): Promise<number> {
  if (!(await spansTableExists())) return 0;
  const { traceRetentionDays } = await getAgentSettings();
  let deleted = 0;
  if (traceRetentionDays > 0) {
    deleted += await deleteUntilDone(
      sql`"startedAtZ" < now() - make_interval(days => ${traceRetentionDays})`,
    );
  }
  // A deleted team takes its agents and its runs with it, but the spans carry no foreign
  // keys of ours, so its traces are left behind for this.
  deleted += await deleteUntilDone(
    sql`${traceTeamId} IS NULL OR ${traceTeamId} NOT IN (SELECT id FROM ${team})`,
  );
  return deleted;
}
