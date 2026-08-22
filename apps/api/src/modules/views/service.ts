import { db, projectView, projectViewFavorite } from '@repo/db';
import { and, eq, sql } from 'drizzle-orm';
import { iso, num } from '#shared/lib';

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
  // Whether the share link exposes the full issues (assignees, labels, custom
  // fields, activity) or only their title, description, state, type, priority,
  // dates, subtasks and links.
  shareExtended: boolean;
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
    shareExtended: row.shareExtended,
    createdAt: iso(row.createdAt),
  };
}

export interface UserViewRow extends ViewRow {
  favorite: boolean;
}

export async function listViews(projectId: number, userId: string): Promise<UserViewRow[]> {
  const rows = await db
    .select({ row: projectView, favoriteUserId: projectViewFavorite.userId })
    .from(projectView)
    .leftJoin(
      projectViewFavorite,
      and(eq(projectViewFavorite.viewId, projectView.id), eq(projectViewFavorite.userId, userId)),
    )
    .where(eq(projectView.projectId, projectId))
    .orderBy(projectView.position, projectView.id);
  return rows.map(({ row, favoriteUserId }) => ({
    ...mapView(row),
    favorite: favoriteUserId !== null,
  }));
}

export async function isFavoriteView(viewId: number, userId: string): Promise<boolean> {
  const rows = await db
    .select({ viewId: projectViewFavorite.viewId })
    .from(projectViewFavorite)
    .where(and(eq(projectViewFavorite.viewId, viewId), eq(projectViewFavorite.userId, userId)));
  return rows.length > 0;
}

export async function addFavoriteView(viewId: number, userId: string): Promise<void> {
  await db.insert(projectViewFavorite).values({ viewId, userId }).onConflictDoNothing();
}

export async function removeFavoriteView(viewId: number, userId: string): Promise<void> {
  await db
    .delete(projectViewFavorite)
    .where(and(eq(projectViewFavorite.viewId, viewId), eq(projectViewFavorite.userId, userId)));
}

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

export async function reorderViews(
  projectId: number,
  orderedIds: number[],
  userId: string,
): Promise<UserViewRow[]> {
  await db.transaction(async (tx) => {
    for (const [position, id] of orderedIds.entries()) {
      await tx
        .update(projectView)
        .set({ position })
        .where(and(eq(projectView.id, id), eq(projectView.projectId, projectId)));
    }
  });
  return listViews(projectId, userId);
}
