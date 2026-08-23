import { db, issueWatcher, projectMember, user, userPreference } from '@repo/db';
import { and, asc, eq, inArray, isNull, or } from 'drizzle-orm';

// Who follows an issue. A watcher receives every notification the issue produces
// (see modules/notifications/service.ts); the assignment and mention notifications are
// addressed to one person and reach them whether they watch the issue or not.
//
// A member subscribes either by hand or through the auto-subscribe rules below.
// Unsubscribing keeps the row with subscribed = false, which is what makes it
// stick: the rules insert and never update, so the member's own next comment
// cannot put them back.

export interface IssueWatcherRow {
  userId: string;
  name: string;
  image: string | null;
}

// The issue's watchers, by name. A watcher who has left the project is left out;
// their row survives, so rejoining puts them back on the list.
export async function listIssueWatchers(
  projectId: number,
  issueId: number,
): Promise<IssueWatcherRow[]> {
  return db
    .select({ userId: issueWatcher.userId, name: user.name, image: user.image })
    .from(issueWatcher)
    .innerJoin(user, eq(user.id, issueWatcher.userId))
    .innerJoin(
      projectMember,
      and(eq(projectMember.userId, issueWatcher.userId), eq(projectMember.projectId, projectId)),
    )
    .where(and(eq(issueWatcher.issueId, issueId), eq(issueWatcher.subscribed, true)))
    .orderBy(asc(user.name));
}

export async function watcherUserIds(projectId: number, issueId: number): Promise<Set<string>> {
  const rows = await listIssueWatchers(projectId, issueId);
  return new Set(rows.map((r) => r.userId));
}

// Subscribes or unsubscribes one member by hand. Both states are stored, so an
// unsubscription survives the auto-subscribe rules.
export async function setIssueWatching(
  issueId: number,
  userId: string,
  subscribed: boolean,
): Promise<void> {
  await db
    .insert(issueWatcher)
    .values({ issueId, userId, subscribed })
    .onConflictDoUpdate({
      target: [issueWatcher.issueId, issueWatcher.userId],
      set: { subscribed },
    });
}

// Subscribes the members that just acted on the issue in a way that implies they
// want to follow it: they created it, were assigned it, commented on it, or were
// mentioned in a comment. A candidate that is not a member of the project (an
// agent's bot user is assigned as a delegate but is not one) or that turned
// auto-subscribe off is skipped. `on conflict do nothing` is what makes an
// unsubscription stick: the row is there with subscribed = false and stays.
export async function autoWatchIssue(
  projectId: number,
  issueId: number,
  userIds: (string | null | undefined)[],
): Promise<void> {
  const ids = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return;
  const rows = await db
    .select({ userId: projectMember.userId })
    .from(projectMember)
    .leftJoin(userPreference, eq(userPreference.userId, projectMember.userId))
    .where(
      and(
        eq(projectMember.projectId, projectId),
        inArray(projectMember.userId, ids),
        // No preference row yet means the default, which is on.
        or(isNull(userPreference.autoWatch), eq(userPreference.autoWatch, true)),
      ),
    );
  if (rows.length === 0) return;
  await db
    .insert(issueWatcher)
    .values(rows.map((r) => ({ issueId, userId: r.userId })))
    .onConflictDoNothing();
}
