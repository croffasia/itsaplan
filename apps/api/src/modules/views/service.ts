import {
  db,
  projectMember,
  projectView,
  projectViewFavorite,
  projectViewPreference,
} from '@repo/db';
import { and, eq, exists, inArray, or, sql, type SQL } from 'drizzle-orm';
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
  hidden: boolean;
}

// Private views are kept by members of the project only. Someone who left it keeps their
// rows, out of sight, until they are a member again or their account is deleted.
const ownPrivate = (userId: string) =>
  and(
    eq(projectView.ownerUserId, userId),
    exists(
      db
        .select({ one: sql`1` })
        .from(projectMember)
        .where(
          and(eq(projectMember.projectId, projectView.projectId), eq(projectMember.userId, userId)),
        ),
    ),
  );

const visibleTo = (userId: string) => or(eq(projectView.isPrivate, false), ownPrivate(userId));

// The caller's tab row: the views they placed, in their order. A view they never placed
// follows the last one of its kind, so a new project view joins the project's and a new
// private one goes last; with nothing placed, the row is the project's views in the
// project's order, then the caller's private ones in the order they were made.
export async function listViews(projectId: number, userId: string): Promise<UserViewRow[]> {
  const rows = await db
    .select({
      row: projectView,
      favoriteUserId: projectViewFavorite.userId,
      placedAt: projectViewPreference.position,
      hidden: projectViewPreference.isHidden,
    })
    .from(projectView)
    .leftJoin(
      projectViewFavorite,
      and(eq(projectViewFavorite.viewId, projectView.id), eq(projectViewFavorite.userId, userId)),
    )
    .leftJoin(
      projectViewPreference,
      and(
        eq(projectViewPreference.viewId, projectView.id),
        eq(projectViewPreference.userId, userId),
      ),
    )
    .where(and(eq(projectView.projectId, projectId), visibleTo(userId)))
    .orderBy(projectView.isPrivate, projectView.position, projectView.id);
  const views = rows.map(({ row, favoriteUserId, placedAt, hidden }) => ({
    view: { ...mapView(row), favorite: favoriteUserId !== null, hidden: hidden ?? false },
    placedAt,
  }));
  const tabRow = views
    .filter((v) => v.placedAt !== null)
    .sort((a, b) => a.placedAt! - b.placedAt!)
    .map((v) => v.view);
  for (const { view, placedAt } of views) {
    if (placedAt !== null) continue;
    let at = tabRow.length;
    if (!view.isPrivate) {
      at = 0;
      tabRow.forEach((v, i) => {
        if (!v.isPrivate) at = i + 1;
      });
    }
    tabRow.splice(at, 0, view);
  }
  return tabRow;
}

export async function isHiddenView(viewId: number, userId: string): Promise<boolean> {
  const rows = await db
    .select({ hidden: projectViewPreference.isHidden })
    .from(projectViewPreference)
    .where(and(eq(projectViewPreference.viewId, viewId), eq(projectViewPreference.userId, userId)));
  return rows[0]?.hidden ?? false;
}

const callerPreferences = (projectId: number, userId: string) =>
  and(
    eq(projectViewPreference.userId, userId),
    inArray(
      projectViewPreference.viewId,
      db
        .select({ id: projectView.id })
        .from(projectView)
        .where(eq(projectView.projectId, projectId)),
    ),
  );

// Places the listed views of the caller's tab row in that order. The views it leaves out
// (the hidden ones the web does not send) lose their place, so one shown again after this
// joins the end of its kind.
export async function arrangeTabRow(
  projectId: number,
  orderedIds: number[],
  userId: string,
): Promise<UserViewRow[]> {
  const known = new Set(
    (
      await db
        .select({ id: projectView.id })
        .from(projectView)
        .where(
          and(
            eq(projectView.projectId, projectId),
            visibleTo(userId),
            inArray(projectView.id, orderedIds),
          ),
        )
    ).map((r) => r.id),
  );
  const placed = [...new Set(orderedIds)].filter((id) => known.has(id));
  await db.transaction(async (tx) => {
    await tx
      .update(projectViewPreference)
      .set({ position: null })
      .where(callerPreferences(projectId, userId));
    if (placed.length === 0) return;
    await tx
      .insert(projectViewPreference)
      .values(placed.map((viewId, position) => ({ viewId, userId, position })))
      .onConflictDoUpdate({
        target: [projectViewPreference.viewId, projectViewPreference.userId],
        set: { position: sql`excluded.position` },
      });
  });
  return listViews(projectId, userId);
}

export async function resetTabRow(projectId: number, userId: string): Promise<UserViewRow[]> {
  await db.delete(projectViewPreference).where(callerPreferences(projectId, userId));
  return listViews(projectId, userId);
}

export async function setViewHidden(viewId: number, userId: string, hidden: boolean) {
  await db
    .insert(projectViewPreference)
    .values({ viewId, userId, isHidden: hidden })
    .onConflictDoUpdate({
      target: [projectViewPreference.viewId, projectViewPreference.userId],
      set: { isHidden: hidden },
    });
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
// both, and only the caller's own private views move. Without `withProjectViews` only
// those move, so a private view published while the list is applied keeps its place.
export async function reorderViews(
  projectId: number,
  orderedIds: number[],
  userId: string,
  withProjectViews: boolean,
): Promise<UserViewRow[]> {
  const movable = withProjectViews ? visibleTo(userId) : ownPrivate(userId);
  await db.transaction(async (tx) => {
    for (const [position, id] of orderedIds.entries()) {
      await tx
        .update(projectView)
        .set({ position })
        .where(and(eq(projectView.id, id), eq(projectView.projectId, projectId), movable));
    }
  });
  return listViews(projectId, userId);
}
