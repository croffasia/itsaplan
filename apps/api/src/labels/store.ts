import { db, label, labelGroup } from '@repo/db';
import { and, eq } from 'drizzle-orm';

// Data access for labels and label groups. Both belong to one project. A label
// has at most one group; deleting a group ungroups its labels (group_id → SET
// NULL). Deleting a label removes it from every issue that has it (ON DELETE
// CASCADE on issue_label.label_id).

// --- Labels --------------------------------------------------------------------

export interface LabelRow {
  id: number;
  projectId: number;
  groupId: number | null;
  name: string;
  color: string;
}

function mapLabel(row: typeof label.$inferSelect): LabelRow {
  return {
    id: row.id,
    projectId: row.projectId,
    groupId: row.groupId ?? null,
    name: row.name,
    color: row.color,
  };
}

export async function listLabels(projectId: number): Promise<LabelRow[]> {
  const rows = await db
    .select()
    .from(label)
    .where(eq(label.projectId, projectId))
    .orderBy(label.name);
  return rows.map(mapLabel);
}

export async function createLabel(input: {
  projectId: number;
  name: string;
  color?: string;
  groupId?: number | null;
}): Promise<LabelRow> {
  const [row] = await db
    .insert(label)
    .values({
      projectId: input.projectId,
      name: input.name,
      color: input.color ?? '#6b7280',
      groupId: input.groupId ?? null,
    })
    .returning();
  return mapLabel(row);
}

// Scoped to projectId so an id from another project resolves to null (a 404 at
// the route), never a cross-project edit.
export async function updateLabel(
  id: number,
  projectId: number,
  patch: { name?: string; color?: string; groupId?: number | null },
): Promise<LabelRow | null> {
  const scope = and(eq(label.id, id), eq(label.projectId, projectId));
  const set: Partial<typeof label.$inferInsert> = {};
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.color !== undefined) set.color = patch.color;
  if (patch.groupId !== undefined) set.groupId = patch.groupId;
  if (Object.keys(set).length === 0) {
    const rows = await db.select().from(label).where(scope);
    return rows[0] ? mapLabel(rows[0]) : null;
  }
  const [row] = await db.update(label).set(set).where(scope).returning();
  return row ? mapLabel(row) : null;
}

// Scoped to projectId: an id outside the project deletes nothing.
export async function deleteLabel(id: number, projectId: number): Promise<void> {
  await db.delete(label).where(and(eq(label.id, id), eq(label.projectId, projectId)));
}

// --- Label groups --------------------------------------------------------------

export interface LabelGroupRow {
  id: number;
  projectId: number;
  name: string;
  color: string;
}

function mapLabelGroup(row: typeof labelGroup.$inferSelect): LabelGroupRow {
  return { id: row.id, projectId: row.projectId, name: row.name, color: row.color };
}

export async function listLabelGroups(projectId: number): Promise<LabelGroupRow[]> {
  const rows = await db
    .select()
    .from(labelGroup)
    .where(eq(labelGroup.projectId, projectId))
    .orderBy(labelGroup.name);
  return rows.map(mapLabelGroup);
}

export async function createLabelGroup(input: {
  projectId: number;
  name: string;
  color?: string;
}): Promise<LabelGroupRow> {
  const [row] = await db
    .insert(labelGroup)
    .values({ projectId: input.projectId, name: input.name, color: input.color ?? '#6b7280' })
    .returning();
  return mapLabelGroup(row);
}

// Scoped to projectId so an id from another project resolves to null (a 404 at
// the route), never a cross-project edit.
export async function updateLabelGroup(
  id: number,
  projectId: number,
  patch: { name?: string; color?: string },
): Promise<LabelGroupRow | null> {
  const scope = and(eq(labelGroup.id, id), eq(labelGroup.projectId, projectId));
  const set: Partial<typeof labelGroup.$inferInsert> = {};
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.color !== undefined) set.color = patch.color;
  if (Object.keys(set).length === 0) {
    const rows = await db.select().from(labelGroup).where(scope);
    return rows[0] ? mapLabelGroup(rows[0]) : null;
  }
  const [row] = await db.update(labelGroup).set(set).where(scope).returning();
  return row ? mapLabelGroup(row) : null;
}

// Scoped to projectId: an id outside the project deletes nothing.
export async function deleteLabelGroup(id: number, projectId: number): Promise<void> {
  await db
    .delete(labelGroup)
    .where(and(eq(labelGroup.id, id), eq(labelGroup.projectId, projectId)));
}
