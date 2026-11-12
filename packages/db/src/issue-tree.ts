import { sql } from 'drizzle-orm';
import { db, type DbExecutor } from './client';

// An issue with no parent is on level 1.
export const MAX_SUBTASK_DEPTH = 8;

const ISSUE_TREE_LOCK_NAMESPACE = 1_145_390_933;

// Serializes the parent links written in a project. The check runs before the write,
// so two concurrent writes would each pass it and together close a cycle (A under B,
// B under A) or go past the depth limit. Held until the caller's transaction ends.
export async function lockIssueTree(executor: DbExecutor, projectId: number): Promise<void> {
  await executor.execute(
    sql`select pg_advisory_xact_lock(${ISSUE_TREE_LOCK_NAMESPACE}, ${projectId})`,
  );
}

// The recursive parts walk with UNION, which drops a row already seen, so a parent
// cycle in old data ends the walk instead of looping. The level counter in
// parentLinkProblem stops it one past the limit for the same reason.
//
// ancestorIds and subtreeIds stay inside one project: a parent link an old import
// wrote across projects is not followed, so a caller authorised for one project
// never reaches the issues of another.

// The issues above the issue, from the one on level 1 down to its parent. Empty for
// an issue with no parent.
export async function ancestorIds(issueId: number, executor: DbExecutor = db): Promise<number[]> {
  const rows = (await executor.execute(sql`
    WITH RECURSIVE up(id, parent_id, project_id) AS (
      SELECT id, parent_id, project_id FROM issue WHERE id = ${issueId}
      UNION
      SELECT i.id, i.parent_id, i.project_id FROM issue i
        JOIN up ON i.id = up.parent_id AND i.project_id = up.project_id
    )
    SELECT id, parent_id FROM up
  `)) as unknown as { id: number; parent_id: number | null }[];
  const parentOf = new Map(rows.map((row) => [row.id, row.parent_id]));
  const ids: number[] = [];
  for (let id = parentOf.get(issueId); id != null; id = parentOf.get(id)) {
    if (id === issueId || ids.includes(id) || !parentOf.has(id)) break;
    ids.push(id);
  }
  return ids.reverse();
}

// The issues and every issue under them, archived ones included.
export async function subtreeIds(issueIds: number[], executor: DbExecutor = db): Promise<number[]> {
  if (issueIds.length === 0) return [];
  const rows = (await executor.execute(sql`
    WITH RECURSIVE down(id, project_id) AS (
      SELECT id, project_id FROM issue WHERE id IN (${sql.join(
        issueIds.map((id) => sql`${id}`),
        sql`, `,
      )})
      UNION
      SELECT i.id, i.project_id FROM issue i
        JOIN down ON i.parent_id = down.id AND i.project_id = down.project_id
    )
    SELECT id FROM down
  `)) as unknown as { id: number }[];
  return rows.map((row) => row.id);
}

// Why issueId cannot go under parentId, or null when it can: 'cycle' when the parent
// is the issue itself or one of its subtasks at any level, 'depth' when the issue
// and the subtasks under it would reach past MAX_SUBTASK_DEPTH. issueId is null for
// an issue being created, which has no subtasks yet.
export async function parentLinkProblem(
  issueId: number | null,
  parentId: number,
  executor: DbExecutor = db,
): Promise<'cycle' | 'depth' | null> {
  if (issueId === parentId) return 'cycle';
  const rows = (await executor.execute(sql`
    WITH RECURSIVE up(id, parent_id) AS (
      SELECT id, parent_id FROM issue WHERE id = ${parentId}
      UNION
      SELECT i.id, i.parent_id FROM issue i JOIN up ON i.id = up.parent_id
    ),
    down(id, level) AS (
      SELECT id, 1 FROM issue WHERE id = ${issueId}::int
      UNION ALL
      SELECT i.id, down.level + 1 FROM issue i JOIN down ON i.parent_id = down.id
       WHERE down.level <= ${MAX_SUBTASK_DEPTH}
    )
    SELECT
      EXISTS (SELECT 1 FROM up WHERE id = ${issueId}::int) AS cycle,
      (SELECT count(*) FROM up)::int + (SELECT coalesce(max(level), 1) FROM down)::int AS levels
  `)) as unknown as { cycle: boolean; levels: number }[];
  const row = rows[0];
  if (row?.cycle) return 'cycle';
  if ((row?.levels ?? 0) > MAX_SUBTASK_DEPTH) return 'depth';
  return null;
}
