import { db, projectColumn, issue, issueLabel, issueFieldValue, issueFieldOption } from '@repo/db';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { HttpError } from '../shared/lib';

// Data access for columns (kanban states). A column belongs to one project and
// has a state type that fixes its place in the work items view's left-to-right order.

export interface ColumnRow {
  id: number;
  projectId: number;
  name: string;
  stateType: string;
  color: string;
  position: number;
}

function mapColumn(row: typeof projectColumn.$inferSelect): ColumnRow {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    stateType: row.stateType,
    color: row.color,
    position: row.position,
  };
}

// Columns are ordered by state type (backlog → unstarted → started → completed
// → canceled), then by position within a type. This is the work items view's left-to-right
// order, so a newly added column appears next to the others of its state type
// rather than at the end.
const STATE_TYPE_ORDER = sql`CASE ${projectColumn.stateType}
    WHEN 'backlog' THEN 0
    WHEN 'unstarted' THEN 1
    WHEN 'started' THEN 2
    WHEN 'completed' THEN 3
    WHEN 'canceled' THEN 4
    ELSE 5
  END`;

export async function listColumns(projectId: number): Promise<ColumnRow[]> {
  const rows = await db
    .select()
    .from(projectColumn)
    .where(eq(projectColumn.projectId, projectId))
    .orderBy(STATE_TYPE_ORDER, projectColumn.position);
  return rows.map(mapColumn);
}

export async function createColumn(input: {
  projectId: number;
  name: string;
  stateType: string;
  color?: string;
}): Promise<ColumnRow> {
  const [{ pos }] = await db
    .select({ pos: sql<number>`COALESCE(MAX(${projectColumn.position}), -1) + 1` })
    .from(projectColumn)
    .where(eq(projectColumn.projectId, input.projectId));
  const [row] = await db
    .insert(projectColumn)
    .values({
      projectId: input.projectId,
      name: input.name,
      stateType: input.stateType,
      color: input.color ?? '#6b7280',
      position: Number(pos),
    })
    .returning();
  return mapColumn(row);
}

export async function getColumnById(id: number): Promise<ColumnRow | null> {
  const rows = await db.select().from(projectColumn).where(eq(projectColumn.id, id));
  return rows[0] ? mapColumn(rows[0]) : null;
}

// Scoped to projectId so a column id from another project resolves to null (the
// route turns that into a 404), never a cross-project edit.
export async function updateColumn(
  id: number,
  projectId: number,
  patch: { name?: string; color?: string; stateType?: string },
): Promise<ColumnRow | null> {
  const scope = and(eq(projectColumn.id, id), eq(projectColumn.projectId, projectId));
  const set: Partial<typeof projectColumn.$inferInsert> = {};
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.color !== undefined) set.color = patch.color;
  if (patch.stateType !== undefined) set.stateType = patch.stateType;
  if (Object.keys(set).length === 0) {
    const rows = await db.select().from(projectColumn).where(scope);
    return rows[0] ? mapColumn(rows[0]) : null;
  }
  const [row] = await db.update(projectColumn).set(set).where(scope).returning();
  return row ? mapColumn(row) : null;
}

// Renumbers the project's columns to match orderedIds (the desired left-to-right
// order). Any column not listed is appended in its current order. Runs a two-pass
// update — first shift every position out of range, then assign 0..n-1 — so the
// UNIQUE(project_id, position) constraint never sees a transient duplicate.
export async function reorderColumns(projectId: number, orderedIds: number[]): Promise<void> {
  const existing = await listColumns(projectId);
  const known = new Set(existing.map((c) => c.id));
  const finalOrder = orderedIds.filter((id) => known.has(id));
  for (const c of existing) if (!finalOrder.includes(c.id)) finalOrder.push(c.id);

  await db.transaction(async (tx) => {
    await tx
      .update(projectColumn)
      .set({ position: sql`${projectColumn.position} + 1000000` })
      .where(eq(projectColumn.projectId, projectId));
    for (const [index, id] of finalOrder.entries()) {
      await tx
        .update(projectColumn)
        .set({ position: index })
        .where(and(eq(projectColumn.id, id), eq(projectColumn.projectId, projectId)));
    }
  });
}

// Deletes a column. `move` reassigns the column's issues to targetColumnId before
// dropping the column; `delete` removes the issues and their dependent rows
// (labels, custom field values/options) first. Backlog columns cannot be deleted,
// which keeps at least one column on every project. Runs in one transaction so the
// column and its issues are never left half-deleted.
export type DeleteColumnOptions = { mode: 'move'; targetColumnId: number } | { mode: 'delete' };

export async function deleteColumn(
  columnId: number,
  projectId: number,
  opts: DeleteColumnOptions,
): Promise<void> {
  const column = await getColumnById(columnId);
  // Scoped to projectId: a column id outside the caller's project is a 404, not a
  // cross-project delete.
  if (!column || column.projectId !== projectId)
    throw new HttpError(404, `Column ${columnId} not found`);
  if (column.stateType === 'backlog') throw new HttpError(400, 'Backlog columns cannot be deleted');

  if (opts.mode === 'move') {
    const target = await getColumnById(opts.targetColumnId);
    if (!target || target.projectId !== column.projectId)
      throw new HttpError(400, 'Target column must belong to the same project');
    if (target.id === column.id)
      throw new HttpError(400, 'Target column must differ from the deleted column');
  }

  await db.transaction(async (tx) => {
    if (opts.mode === 'move') {
      await tx
        .update(issue)
        .set({ columnId: opts.targetColumnId, updatedAt: sql`now()` })
        .where(eq(issue.columnId, columnId));
    } else {
      const issueIds = tx.select({ id: issue.id }).from(issue).where(eq(issue.columnId, columnId));
      await tx.delete(issueFieldOption).where(inArray(issueFieldOption.issueId, issueIds));
      await tx.delete(issueFieldValue).where(inArray(issueFieldValue.issueId, issueIds));
      await tx.delete(issueLabel).where(inArray(issueLabel.issueId, issueIds));
      await tx.delete(issue).where(eq(issue.columnId, columnId));
    }
    await tx.delete(projectColumn).where(eq(projectColumn.id, columnId));
  });
}
