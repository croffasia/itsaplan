import { db, braindumpEntry, user } from '@repo/db';
import { and, desc, eq, gte, ilike, or, sql } from 'drizzle-orm';
import { iso, num } from '../shared/lib';

export const BRAINDUMP_KINDS = ['idea', 'task', 'note', 'voice'] as const;
export type BraindumpKind = (typeof BRAINDUMP_KINDS)[number];

export const BRAINDUMP_DESTINATIONS = ['obsidian', 'issue', 'schedule'] as const;
export type BraindumpDestination = (typeof BRAINDUMP_DESTINATIONS)[number];

export interface BraindumpEntryRow {
  id: number;
  kind: BraindumpKind;
  title: string;
  body: string;
  tags: string[];
  pinned: boolean;
  authorName: string | null;
  hasAudio: boolean;
  audioDurationSec: number | null;
  routedTo: BraindumpDestination | null;
  routedAt: string | null;
  routedRef: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BraindumpStats {
  routedToday: number;
  unsorted: number;
  byDestination: { destination: BraindumpDestination | 'unsorted'; count: number }[];
  // One bucket per day over the requested window, oldest first, so the caller
  // renders the series without filling gaps itself.
  daily: { date: string; count: number }[];
  total: number;
  averagePerDay: number;
}

const columns = {
  id: braindumpEntry.id,
  kind: braindumpEntry.kind,
  title: braindumpEntry.title,
  body: braindumpEntry.body,
  tags: braindumpEntry.tags,
  pinned: braindumpEntry.pinned,
  authorName: user.name,
  audioS3Key: braindumpEntry.audioS3Key,
  audioDurationSec: braindumpEntry.audioDurationSec,
  routedTo: braindumpEntry.routedTo,
  routedAt: braindumpEntry.routedAt,
  routedRef: braindumpEntry.routedRef,
  createdAt: braindumpEntry.createdAt,
  updatedAt: braindumpEntry.updatedAt,
};

type SelectedRow = {
  id: number;
  kind: string;
  title: string;
  body: string;
  tags: string[];
  pinned: boolean;
  authorName: string | null;
  audioS3Key: string | null;
  audioDurationSec: number | null;
  routedTo: string | null;
  routedAt: Date | null;
  routedRef: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function present(row: SelectedRow): BraindumpEntryRow {
  return {
    id: row.id,
    kind: row.kind as BraindumpKind,
    title: row.title,
    body: row.body,
    tags: row.tags,
    pinned: row.pinned,
    authorName: row.authorName,
    // The key itself never leaves the API; the audio is served by its own route.
    hasAudio: row.audioS3Key != null,
    audioDurationSec: row.audioDurationSec,
    routedTo: row.routedTo as BraindumpDestination | null,
    routedAt: row.routedAt ? iso(row.routedAt) : null,
    routedRef: row.routedRef,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export interface ListBraindumpFilters {
  kind?: BraindumpKind;
  tag?: string;
  search?: string;
  days?: number;
}

export async function listBraindumpEntries(
  projectId: number,
  filters: ListBraindumpFilters = {},
): Promise<BraindumpEntryRow[]> {
  const where = [eq(braindumpEntry.projectId, projectId)];
  if (filters.kind) where.push(eq(braindumpEntry.kind, filters.kind));
  if (filters.days != null) where.push(gte(braindumpEntry.createdAt, daysAgo(filters.days)));
  if (filters.tag) {
    where.push(sql`${braindumpEntry.tags} @> ${JSON.stringify([filters.tag])}::jsonb`);
  }
  if (filters.search) {
    const pattern = `%${filters.search}%`;
    const match = or(ilike(braindumpEntry.title, pattern), ilike(braindumpEntry.body, pattern));
    if (match) where.push(match);
  }
  const rows = await db
    .select(columns)
    .from(braindumpEntry)
    .leftJoin(user, eq(user.id, braindumpEntry.authorUserId))
    .where(and(...where))
    .orderBy(desc(braindumpEntry.pinned), desc(braindumpEntry.createdAt));
  return rows.map(present);
}

export async function getBraindumpEntry(entryId: number): Promise<BraindumpEntryRow | null> {
  const rows = await db
    .select(columns)
    .from(braindumpEntry)
    .leftJoin(user, eq(user.id, braindumpEntry.authorUserId))
    .where(eq(braindumpEntry.id, entryId));
  return rows[0] ? present(rows[0]) : null;
}

// The owning project of an entry, for the route guard. Null when it does not exist.
export async function getBraindumpEntryProjectId(entryId: number): Promise<number | null> {
  const rows = await db
    .select({ projectId: braindumpEntry.projectId })
    .from(braindumpEntry)
    .where(eq(braindumpEntry.id, entryId));
  return rows[0]?.projectId ?? null;
}

// The stored object key, needed to stream or delete the audio. Kept out of the DTO.
export async function getBraindumpAudioKey(entryId: number): Promise<string | null> {
  const rows = await db
    .select({ key: braindumpEntry.audioS3Key })
    .from(braindumpEntry)
    .where(eq(braindumpEntry.id, entryId));
  return rows[0]?.key ?? null;
}

export interface NewBraindumpEntry {
  projectId: number;
  authorUserId: string | null;
  kind: BraindumpKind;
  title: string;
  body: string;
  tags: string[];
  audioS3Key?: string | null;
  audioDurationSec?: number | null;
  audioSizeBytes?: number | null;
}

export async function createBraindumpEntry(input: NewBraindumpEntry): Promise<BraindumpEntryRow> {
  const [row] = await db
    .insert(braindumpEntry)
    .values({
      projectId: input.projectId,
      authorUserId: input.authorUserId,
      kind: input.kind,
      title: input.title,
      body: input.body,
      tags: input.tags,
      audioS3Key: input.audioS3Key ?? null,
      audioDurationSec: input.audioDurationSec ?? null,
      audioSizeBytes: input.audioSizeBytes ?? null,
    })
    .returning({ id: braindumpEntry.id });
  const created = await getBraindumpEntry(row.id);
  if (!created) throw new Error('Braindump entry disappeared right after insert');
  return created;
}

export interface BraindumpEntryPatch {
  title?: string;
  body?: string;
  tags?: string[];
  kind?: BraindumpKind;
  pinned?: boolean;
}

export async function updateBraindumpEntry(
  entryId: number,
  patch: BraindumpEntryPatch,
): Promise<BraindumpEntryRow | null> {
  await db
    .update(braindumpEntry)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(braindumpEntry.id, entryId));
  return getBraindumpEntry(entryId);
}

export async function markBraindumpRouted(
  entryId: number,
  destination: BraindumpDestination,
  ref: string,
): Promise<BraindumpEntryRow | null> {
  await db
    .update(braindumpEntry)
    .set({ routedTo: destination, routedAt: new Date(), routedRef: ref, updatedAt: new Date() })
    .where(eq(braindumpEntry.id, entryId));
  return getBraindumpEntry(entryId);
}

export async function deleteBraindumpEntry(entryId: number): Promise<void> {
  await db.delete(braindumpEntry).where(eq(braindumpEntry.id, entryId));
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export async function getBraindumpStats(
  projectId: number,
  windowDays: number,
): Promise<BraindumpStats> {
  const since = daysAgo(windowDays - 1);
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);

  const [routedTodayRows, destinationRows, dailyRows] = await Promise.all([
    db
      .select({ count: sql<string>`count(*)` })
      .from(braindumpEntry)
      .where(
        and(
          eq(braindumpEntry.projectId, projectId),
          gte(braindumpEntry.routedAt, startOfToday),
          sql`${braindumpEntry.routedTo} is not null`,
        ),
      ),
    db
      .select({
        destination: sql<string>`coalesce(${braindumpEntry.routedTo}, 'unsorted')`,
        count: sql<string>`count(*)`,
      })
      .from(braindumpEntry)
      .where(eq(braindumpEntry.projectId, projectId))
      .groupBy(sql`coalesce(${braindumpEntry.routedTo}, 'unsorted')`),
    db
      .select({
        date: sql<string>`to_char(${braindumpEntry.createdAt} at time zone 'UTC', 'YYYY-MM-DD')`,
        count: sql<string>`count(*)`,
      })
      .from(braindumpEntry)
      .where(and(eq(braindumpEntry.projectId, projectId), gte(braindumpEntry.createdAt, since)))
      .groupBy(sql`to_char(${braindumpEntry.createdAt} at time zone 'UTC', 'YYYY-MM-DD')`),
  ]);

  const byDate = new Map(dailyRows.map((r) => [r.date, num(r.count)]));
  const daily: { date: string; count: number }[] = [];
  for (let i = windowDays - 1; i >= 0; i--) {
    const date = daysAgo(i).toISOString().slice(0, 10);
    daily.push({ date, count: byDate.get(date) ?? 0 });
  }

  const byDestination = destinationRows.map((r) => ({
    destination: r.destination as BraindumpDestination | 'unsorted',
    count: num(r.count),
  }));
  const total = daily.reduce((sum, d) => sum + d.count, 0);
  return {
    routedToday: num(routedTodayRows[0]?.count ?? 0),
    unsorted: byDestination.find((d) => d.destination === 'unsorted')?.count ?? 0,
    byDestination,
    daily,
    total,
    averagePerDay: windowDays > 0 ? Math.round((total / windowDays) * 10) / 10 : 0,
  };
}
