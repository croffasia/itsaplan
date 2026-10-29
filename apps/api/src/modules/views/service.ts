import { db, projectView, projectViewFavorite } from '@repo/db';
import { and, eq, inArray, or, sql, type SQL } from 'drizzle-orm';
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
  isPrivate: boolean;
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
    isPrivate: row.isPrivate,
    createdAt: iso(row.createdAt),
  };
}

export interface UserViewRow extends ViewRow {
  favorite: boolean;
}

const visibleTo = (userId: string) =>
  or(eq(projectView.isPrivate, false), eq(projectView.ownerUserId, userId));

export async function listViews(projectId: number, userId: string): Promise<UserViewRow[]> {
  const rows = await db
    .select({ row: projectView, favoriteUserId: projectViewFavorite.userId })
    .from(projectView)
    .leftJoin(
      projectViewFavorite,
      and(eq(projectViewFavorite.viewId, projectView.id), eq(projectViewFavorite.userId, userId)),
    )
    .where(and(eq(projectView.projectId, projectId), visibleTo(userId)))
    // The project's views keep their order; private ones follow, in the order their owner gave them.
    .orderBy(projectView.isPrivate, projectView.position, projectView.id);
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
  ownerUserId?: string | null;
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
      isPrivate: !!input.ownerUserId,
      ownerUserId: input.ownerUserId ?? null,
    })
    .returning();
  return mapView(row);
}

async function getViewWhere(where: SQL | undefined): Promise<ViewRow | null> {
  const rows = await db.select().from(projectView).where(where);
  return rows[0] ? mapView(rows[0]) : null;
}

// Someone else's private view is reported as missing, so its id reveals nothing.
export function getView(id: number, userId: string | null): Promise<ViewRow | null> {
  return getViewWhere(
    and(eq(projectView.id, id), userId ? visibleTo(userId) : eq(projectView.isPrivate, false)),
  );
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
  if (Object.keys(set).length === 0) return getViewWhere(eq(projectView.id, id));
  const [row] = await db.update(projectView).set(set).where(eq(projectView.id, id)).returning();
  return row ? mapView(row) : null;
}

// A published view joins the end of the project's order and no longer has an owner. It is
// one way: turning a project's view private would take it from everyone who uses it.
export async function publishView(id: number, projectId: number): Promise<ViewRow | null> {
  const [{ pos }] = await db
    .select({ pos: sql<number>`COALESCE(MAX(${projectView.position}) + 1, 0)` })
    .from(projectView)
    .where(eq(projectView.projectId, projectId));
  const [row] = await db
    .update(projectView)
    .set({ isPrivate: false, ownerUserId: null, position: Number(pos) })
    .where(and(eq(projectView.id, id), eq(projectView.isPrivate, true)))
    .returning();
  return row ? mapView(row) : null;
}

export async function deleteView(id: number): Promise<void> {
  await db.delete(projectView).where(eq(projectView.id, id));
}

export async function includesProjectViews(projectId: number, ids: number[]): Promise<boolean> {
  const rows = await db
    .select({ id: projectView.id })
    .from(projectView)
    .where(
      and(
        eq(projectView.projectId, projectId),
        inArray(projectView.id, ids),
        eq(projectView.isPrivate, false),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

// Private views are ordered among themselves, after the project's: a list may hold
// both, and only the caller's own private views move.
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
        .where(
          and(eq(projectView.id, id), eq(projectView.projectId, projectId), visibleTo(userId)),
        );
    }
  });
  return listViews(projectId, userId);
}
