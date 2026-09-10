import { db } from '@repo/db';
import { sql } from 'drizzle-orm';
import { deleteThreadsWhere } from '#modules/agents/core/runtime/memory';

// Archives active issues that have sat inactive in a completed/canceled column past
// their project's threshold, and drops the agent conversation threads of the ones it
// archives. Inactivity is measured by issue.updated_at: moving to a terminal column
// bumps it, and any later edit resets the clock, so an issue is archived only after
// the full period with no activity.
export async function sweepStaleIssues(): Promise<number> {
  // The threshold lives in project_setting under key 'auto_archive' as
  // { completedDays, canceledDays } (kept in sync with getAutoArchiveSettings in
  // modules/projects/service.ts); a positive day count enables archiving for that state
  // group, null/absent disables it. The numeric-string regex guards the cast, so a
  // malformed value is treated as disabled rather than raising.
  const rows = await db.execute(sql`
    UPDATE issue i
    SET archived_at = now()
    FROM project_column c, project_setting s
    WHERE i.column_id = c.id
      AND i.project_id = s.project_id
      AND s.key = 'auto_archive'
      AND i.archived_at IS NULL
      AND (
        (c.state_type = 'completed'
          AND (s.value->>'completedDays') ~ '^[0-9]{1,4}$'
          AND i.updated_at < now() - make_interval(days => (s.value->>'completedDays')::int))
        OR
        (c.state_type = 'canceled'
          AND (s.value->>'canceledDays') ~ '^[0-9]{1,4}$'
          AND i.updated_at < now() - make_interval(days => (s.value->>'canceledDays')::int))
      )
    RETURNING i.id
  `);
  const archived = rows as unknown as Array<{ id: number }>;
  for (const row of archived) await deleteThreadsWhere({ issueId: row.id });
  return archived.length;
}
