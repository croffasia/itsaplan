import { db, projectView } from '@repo/db';
import { and, eq, sql } from 'drizzle-orm';
import { iso, num } from '../shared/lib';

// Saved views: the tabs above a project's work items view. filters and display are jsonb
// blobs owned by the UI; this layer stores and returns them without inspecting
// their shape. position orders the tabs.

export interface ViewRow {
  id: number;
  projectId: number;
  name: string;
  icon: string | null;
  filters: unknown;
  display: unknown;
  position: number;
  // Unguessable token for the public read-only share link, or null when the view
  // is not shared.
  shareToken: string | null;
  createdAt: string;
}

function mapView(row: typeof projectView.$inferSelect): ViewRow {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    icon: row.icon,
    filters: row.filters,
    display: row.display,
    position: num(row.position),
    shareToken: row.shareToken,
    createdAt: iso(row.createdAt),
  };
}

export async function listViews(projectId: number): Promise<ViewRow[]> {
  const rows = await db
    .select()
    .from(projectView)
    .where(eq(projectView.projectId, projectId))
    .orderBy(projectView.position, projectView.id);
  return rows.map(mapView);
}

// New views go to the end of the tab row (max position + 1). filters/display are
// stored verbatim in the jsonb columns.
export async function createView(input: {
  projectId: number;
  name: string;
  icon?: string | null;
  filters?: unknown;
  display?: unknown;
}): Promise<ViewRow> {
  const [{ pos }] = await db
    .select({ pos: sql<number>`COALESCE(MAX(${projectView.position}) + 1, 0)` })
    .from(projectView)
    .where(eq(projectView.projectId, input.projectId));
  const [row] = await db
    .insert(projectView)
    .values({
      projectId: input.projectId,
      name: input.name,
      icon: input.icon ?? null,
      filters: input.filters ?? {},
      display: input.display ?? {},
      position: Number(pos),
    })
    .returning();
  return mapView(row);
}

export async function getView(id: number): Promise<ViewRow | null> {
  const rows = await db.select().from(projectView).where(eq(projectView.id, id));
  return rows[0] ? mapView(rows[0]) : null;
}

// Updates only the provided fields. filters/display are replaced wholesale (not
// merged), since the UI always sends the full blob.
export async function updateView(
  id: number,
  patch: { name?: string; icon?: string | null; filters?: unknown; display?: unknown },
): Promise<ViewRow | null> {
  const set: Partial<typeof projectView.$inferInsert> = {};
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.icon !== undefined) set.icon = patch.icon;
  if (patch.filters !== undefined) set.filters = patch.filters;
  if (patch.display !== undefined) set.display = patch.display;
  if (Object.keys(set).length === 0) return getView(id);
  const [row] = await db.update(projectView).set(set).where(eq(projectView.id, id)).returning();
  return row ? mapView(row) : null;
}

export async function deleteView(id: number): Promise<void> {
  await db.delete(projectView).where(eq(projectView.id, id));
}

// Sets each view's position to its index in orderedIds, in one transaction, so
// the tab order the UI sends is stored exactly. Ids not on the project are ignored.
export async function reorderViews(projectId: number, orderedIds: number[]): Promise<ViewRow[]> {
  await db.transaction(async (tx) => {
    for (const [position, id] of orderedIds.entries()) {
      await tx
        .update(projectView)
        .set({ position })
        .where(and(eq(projectView.id, id), eq(projectView.projectId, projectId)));
    }
  });
  return listViews(projectId);
}
