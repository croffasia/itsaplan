import { db, competitor, competitorEvent, competitorSnapshot } from '@repo/db';
import { and, desc, eq, isNull, lt, or, sql } from 'drizzle-orm';
import { iso, num } from '../shared/lib';
import type { DetectedEvent, SnapshotInput } from './diff';
import type { CompetitorPlatform } from './providers';

export interface SnapshotRow {
  followers: number | null;
  following: number | null;
  posts: number | null;
  displayName: string | null;
  biography: string | null;
  avatarUrl: string | null;
  latestPostId: string | null;
  latestPostUrl: string | null;
  latestPostAt: string | null;
  latestPostCaption: string | null;
  capturedAt: string;
}

export interface CompetitorRow {
  id: number;
  platform: CompetitorPlatform;
  handle: string;
  label: string | null;
  tags: string[];
  active: boolean;
  lastCheckedAt: string | null;
  lastError: string | null;
  consecutiveFailures: number;
  latest: SnapshotRow | null;
  // The follower change over the readings taken in the last seven days, so the
  // list can show a trend without the caller fetching every snapshot.
  followerChange7d: number | null;
  createdAt: string;
}

const latestSnapshot = sql`(
  select row_to_json(s) from ${competitorSnapshot} s
  where s.competitor_id = ${competitor.id}
  order by s.captured_at desc limit 1
)`;

const followersSevenDaysAgo = sql<number | null>`(
  select s.followers from ${competitorSnapshot} s
  where s.competitor_id = ${competitor.id}
    and s.captured_at <= now() - interval '7 days'
  order by s.captured_at desc limit 1
)`;

type RawSnapshot = {
  followers: number | null;
  following: number | null;
  posts: number | null;
  display_name: string | null;
  biography: string | null;
  avatar_url: string | null;
  latest_post_id: string | null;
  latest_post_url: string | null;
  latest_post_at: string | null;
  latest_post_caption: string | null;
  captured_at: string;
};

function presentSnapshot(raw: RawSnapshot | null): SnapshotRow | null {
  if (!raw) return null;
  return {
    followers: raw.followers,
    following: raw.following,
    posts: raw.posts,
    displayName: raw.display_name,
    biography: raw.biography,
    avatarUrl: raw.avatar_url,
    latestPostId: raw.latest_post_id,
    latestPostUrl: raw.latest_post_url,
    latestPostAt: raw.latest_post_at ? new Date(raw.latest_post_at).toISOString() : null,
    latestPostCaption: raw.latest_post_caption,
    capturedAt: new Date(raw.captured_at).toISOString(),
  };
}

const columns = {
  id: competitor.id,
  platform: competitor.platform,
  handle: competitor.handle,
  label: competitor.label,
  tags: competitor.tags,
  active: competitor.active,
  lastCheckedAt: competitor.lastCheckedAt,
  lastError: competitor.lastError,
  consecutiveFailures: competitor.consecutiveFailures,
  latest: latestSnapshot,
  followersBefore: followersSevenDaysAgo,
  createdAt: competitor.createdAt,
};

type SelectedRow = {
  id: number;
  platform: string;
  handle: string;
  label: string | null;
  tags: string[];
  active: boolean;
  lastCheckedAt: Date | null;
  lastError: string | null;
  consecutiveFailures: number;
  latest: unknown;
  followersBefore: number | null;
  createdAt: Date;
};

function present(row: SelectedRow): CompetitorRow {
  const latest = presentSnapshot((row.latest as RawSnapshot | null) ?? null);
  const before = row.followersBefore;
  return {
    id: row.id,
    platform: row.platform as CompetitorPlatform,
    handle: row.handle,
    label: row.label,
    tags: row.tags,
    active: row.active,
    lastCheckedAt: row.lastCheckedAt ? iso(row.lastCheckedAt) : null,
    lastError: row.lastError,
    consecutiveFailures: row.consecutiveFailures,
    latest,
    followerChange7d:
      before != null && latest?.followers != null ? latest.followers - before : null,
    createdAt: iso(row.createdAt),
  };
}

// A handle is stored bare and lowercased so the same account cannot be added twice
// as "@Brand", "brand" and a pasted profile URL.
export function normaliseHandle(raw: string): string {
  const trimmed = raw.trim();
  const fromUrl = trimmed.match(/^https?:\/\/[^/]+\/(?:@)?([^/?#]+)/i);
  const handle = (fromUrl ? fromUrl[1] : trimmed).replace(/^@/, '');
  return handle.trim().toLowerCase();
}

export async function listCompetitors(projectId: number): Promise<CompetitorRow[]> {
  const rows = await db
    .select(columns)
    .from(competitor)
    .where(eq(competitor.projectId, projectId))
    .orderBy(desc(competitor.active), competitor.platform, competitor.handle);
  return rows.map(present);
}

export async function getCompetitor(competitorId: number): Promise<CompetitorRow | null> {
  const rows = await db.select(columns).from(competitor).where(eq(competitor.id, competitorId));
  return rows[0] ? present(rows[0]) : null;
}

export async function getCompetitorProjectId(competitorId: number): Promise<number | null> {
  const rows = await db
    .select({ projectId: competitor.projectId })
    .from(competitor)
    .where(eq(competitor.id, competitorId));
  return rows[0]?.projectId ?? null;
}

export interface NewCompetitor {
  projectId: number;
  addedByUserId: string | null;
  platform: CompetitorPlatform;
  handle: string;
  label?: string | null;
  tags?: string[];
}

export async function createCompetitor(input: NewCompetitor): Promise<CompetitorRow> {
  const [row] = await db
    .insert(competitor)
    .values({
      projectId: input.projectId,
      addedByUserId: input.addedByUserId,
      platform: input.platform,
      handle: input.handle,
      label: input.label ?? null,
      tags: input.tags ?? [],
    })
    .returning({ id: competitor.id });
  const created = await getCompetitor(row.id);
  if (!created) throw new Error('Competitor disappeared right after insert');
  return created;
}

export interface CompetitorPatch {
  label?: string | null;
  tags?: string[];
  active?: boolean;
}

export async function updateCompetitor(
  competitorId: number,
  patch: CompetitorPatch,
): Promise<CompetitorRow | null> {
  await db
    .update(competitor)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(competitor.id, competitorId));
  return getCompetitor(competitorId);
}

export async function deleteCompetitor(competitorId: number): Promise<void> {
  await db.delete(competitor).where(eq(competitor.id, competitorId));
}

export async function getLatestSnapshot(competitorId: number): Promise<SnapshotInput | null> {
  const rows = await db
    .select()
    .from(competitorSnapshot)
    .where(eq(competitorSnapshot.competitorId, competitorId))
    .orderBy(desc(competitorSnapshot.capturedAt))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    followers: row.followers,
    following: row.following,
    posts: row.posts,
    displayName: row.displayName,
    biography: row.biography,
    avatarUrl: row.avatarUrl,
    latestPostId: row.latestPostId,
    latestPostUrl: row.latestPostUrl,
    latestPostAt: row.latestPostAt,
    latestPostCaption: row.latestPostCaption,
  };
}

export async function insertSnapshot(competitorId: number, snapshot: SnapshotInput): Promise<void> {
  await db.insert(competitorSnapshot).values({
    competitorId,
    followers: snapshot.followers ?? null,
    following: snapshot.following ?? null,
    posts: snapshot.posts ?? null,
    displayName: snapshot.displayName ?? null,
    biography: snapshot.biography ?? null,
    avatarUrl: snapshot.avatarUrl ?? null,
    latestPostId: snapshot.latestPostId ?? null,
    latestPostUrl: snapshot.latestPostUrl ?? null,
    latestPostAt: snapshot.latestPostAt ?? null,
    latestPostCaption: snapshot.latestPostCaption ?? null,
  });
}

export async function insertEvents(
  projectId: number,
  competitorId: number,
  events: DetectedEvent[],
): Promise<void> {
  if (events.length === 0) return;
  await db.insert(competitorEvent).values(
    events.map((event) => ({
      projectId,
      competitorId,
      kind: event.kind,
      summary: event.summary,
      detail: event.detail as Record<string, unknown>,
      postUrl: event.postUrl ?? null,
    })),
  );
}

export async function recordCheckSuccess(competitorId: number): Promise<void> {
  await db
    .update(competitor)
    .set({
      lastCheckedAt: new Date(),
      lastError: null,
      consecutiveFailures: 0,
      updatedAt: new Date(),
    })
    .where(eq(competitor.id, competitorId));
}

export async function recordCheckFailure(competitorId: number, message: string): Promise<void> {
  await db
    .update(competitor)
    .set({
      lastCheckedAt: new Date(),
      lastError: message.slice(0, 500),
      consecutiveFailures: sql`${competitor.consecutiveFailures} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(competitor.id, competitorId));
}

export interface CompetitorEventRow {
  id: number;
  competitorId: number;
  platform: CompetitorPlatform;
  handle: string;
  kind: string;
  summary: string;
  detail: Record<string, unknown>;
  postUrl: string | null;
  readAt: string | null;
  createdAt: string;
}

export async function listCompetitorEvents(
  projectId: number,
  limit: number,
): Promise<CompetitorEventRow[]> {
  const rows = await db
    .select({
      id: competitorEvent.id,
      competitorId: competitorEvent.competitorId,
      platform: competitor.platform,
      handle: competitor.handle,
      kind: competitorEvent.kind,
      summary: competitorEvent.summary,
      detail: competitorEvent.detail,
      postUrl: competitorEvent.postUrl,
      readAt: competitorEvent.readAt,
      createdAt: competitorEvent.createdAt,
    })
    .from(competitorEvent)
    .innerJoin(competitor, eq(competitor.id, competitorEvent.competitorId))
    .where(eq(competitorEvent.projectId, projectId))
    .orderBy(desc(competitorEvent.createdAt))
    .limit(limit);
  return rows.map((row) => ({
    id: row.id,
    competitorId: row.competitorId,
    platform: row.platform as CompetitorPlatform,
    handle: row.handle,
    kind: row.kind,
    summary: row.summary,
    detail: row.detail,
    postUrl: row.postUrl,
    readAt: row.readAt ? iso(row.readAt) : null,
    createdAt: iso(row.createdAt),
  }));
}

export async function markEventsRead(projectId: number): Promise<number> {
  const rows = await db
    .update(competitorEvent)
    .set({ readAt: new Date() })
    .where(and(eq(competitorEvent.projectId, projectId), isNull(competitorEvent.readAt)))
    .returning({ id: competitorEvent.id });
  return rows.length;
}

export interface CompetitorOverview {
  tracked: number;
  active: number;
  byPlatform: { platform: string; count: number }[];
  alertsToday: number;
  unread: number;
  newPosts24h: number;
  failing: number;
  lastSyncAt: string | null;
}

export async function getCompetitorOverview(projectId: number): Promise<CompetitorOverview> {
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [counts, platformRows, eventRows] = await Promise.all([
    db
      .select({
        tracked: sql<string>`count(*)`,
        active: sql<string>`count(*) filter (where ${competitor.active})`,
        failing: sql<string>`count(*) filter (where ${competitor.consecutiveFailures} > 0)`,
        lastSyncAt: sql<Date | null>`max(${competitor.lastCheckedAt})`,
      })
      .from(competitor)
      .where(eq(competitor.projectId, projectId)),
    db
      .select({ platform: competitor.platform, count: sql<string>`count(*)` })
      .from(competitor)
      .where(eq(competitor.projectId, projectId))
      .groupBy(competitor.platform),
    db
      .select({
        alertsToday: sql<string>`count(*) filter (where ${competitorEvent.createdAt} >= ${startOfToday.toISOString()}::timestamptz)`,
        unread: sql<string>`count(*) filter (where ${competitorEvent.readAt} is null)`,
        newPosts: sql<string>`count(*) filter (where ${competitorEvent.kind} = 'new_post' and ${competitorEvent.createdAt} >= ${dayAgo.toISOString()}::timestamptz)`,
      })
      .from(competitorEvent)
      .where(eq(competitorEvent.projectId, projectId)),
  ]);

  const lastSync = counts[0]?.lastSyncAt ?? null;
  return {
    tracked: num(counts[0]?.tracked ?? 0),
    active: num(counts[0]?.active ?? 0),
    byPlatform: platformRows.map((r) => ({ platform: r.platform, count: num(r.count) })),
    alertsToday: num(eventRows[0]?.alertsToday ?? 0),
    unread: num(eventRows[0]?.unread ?? 0),
    newPosts24h: num(eventRows[0]?.newPosts ?? 0),
    failing: num(counts[0]?.failing ?? 0),
    lastSyncAt: lastSync ? new Date(lastSync).toISOString() : null,
  };
}

export interface DueCompetitor {
  id: number;
  projectId: number;
  platform: CompetitorPlatform;
  handle: string;
}

// The active accounts whose last check is older than the interval, oldest first,
// so a sweep spreads evenly rather than always starting at the same account.
export async function listDueCompetitors(
  intervalMs: number,
  limit: number,
): Promise<DueCompetitor[]> {
  const due = new Date(Date.now() - intervalMs);
  const rows = await db
    .select({
      id: competitor.id,
      projectId: competitor.projectId,
      platform: competitor.platform,
      handle: competitor.handle,
    })
    .from(competitor)
    .where(
      and(
        eq(competitor.active, true),
        or(isNull(competitor.lastCheckedAt), lt(competitor.lastCheckedAt, due)),
      ),
    )
    .orderBy(sql`${competitor.lastCheckedAt} asc nulls first`)
    .limit(limit);
  return rows.map((row) => ({
    id: row.id,
    projectId: row.projectId,
    platform: row.platform as CompetitorPlatform,
    handle: row.handle,
  }));
}

// Events older than this are deleted by the sweep, so the feed stays a recent log
// rather than growing without bound.
export async function pruneCompetitorEvents(olderThanDays: number): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  const rows = await db
    .delete(competitorEvent)
    .where(lt(competitorEvent.createdAt, cutoff))
    .returning({ id: competitorEvent.id });
  return rows.length;
}
