import { db, team, agentRun, agentRunTrace } from '@repo/db';
import { sql, type SQL } from 'drizzle-orm';
import { getAgentSettings } from '#modules/settings/service';
import { spansTableExists } from './store';

const BATCH = 200;
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

// Zero days keeps all traces. Pending external runs are never pruned.
export async function pruneAgentTraces(): Promise<number> {
  const { traceRetentionDays } = await getAgentSettings();
  let deleted = 0;
  if (traceRetentionDays > 0) {
    for (let batch = 0; batch < MAX_BATCHES; batch++) {
      const removed = await db.execute(sql`
        DELETE FROM ${agentRunTrace}
        WHERE (run_id, attempt) IN (
          SELECT t.run_id, t.attempt FROM ${agentRunTrace} t
          INNER JOIN ${agentRun} r ON r.id = t.run_id
          WHERE r.status <> 'pending'
            AND coalesce(r.finished_at, r.created_at) < now() - make_interval(days => ${traceRetentionDays})
          LIMIT ${BATCH}
        )
      `);
      const count = (removed as unknown as { count?: number }).count ?? 0;
      deleted += count;
      if (count === 0) break;
    }
  }
  if (!(await spansTableExists())) return deleted;
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
