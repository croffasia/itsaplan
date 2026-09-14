import { db, mindFact, mindLink, mindRecall, user } from '@repo/db';
import { and, desc, eq, gte, ilike, inArray, lt, ne, or, sql } from 'drizzle-orm';
import { iso, num } from '../shared/lib';

export const MIND_CATEGORIES = [
  'goals',
  'routines',
  'people',
  'clients',
  'infra',
  'business',
  'knowledge',
  'daily_notes',
  'archive',
] as const;
export type MindCategory = (typeof MIND_CATEGORIES)[number];

export const MIND_STATUSES = ['unverified', 'verified', 'flagged', 'conflicted'] as const;
export type MindStatus = (typeof MIND_STATUSES)[number];

export type MindSource = 'manual' | 'braindump' | 'agent';

// A fact is stale once nothing has touched it for this long. Surfaced under memory
// health so the operator re-reads what agents are still acting on.
export const STALE_AFTER_DAYS = 60;

export interface MindFactRow {
  id: number;
  category: MindCategory;
  title: string;
  body: string;
  tags: string[];
  source: MindSource;
  pinned: boolean;
  status: MindStatus;
  confidence: number;
  authorName: string | null;
  braindumpEntryId: number | null;
  linksOut: number;
  linksIn: number;
  recallsThisWeek: number;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const WEEK_AGO = sql`now() - interval '7 days'`;

const columns = {
  id: mindFact.id,
  category: mindFact.category,
  title: mindFact.title,
  body: mindFact.body,
  tags: mindFact.tags,
  source: mindFact.source,
  pinned: mindFact.pinned,
  status: mindFact.status,
  confidence: mindFact.confidence,
  authorName: user.name,
  braindumpEntryId: mindFact.braindumpEntryId,
  linksOut: sql<string>`(select count(*) from ${mindLink} l where l.from_fact_id = ${mindFact.id})`,
  linksIn: sql<string>`(select count(*) from ${mindLink} l where l.to_fact_id = ${mindFact.id})`,
  recallsThisWeek: sql<string>`(
    select count(*) from ${mindRecall} r
    where r.fact_id = ${mindFact.id} and r.created_at >= ${WEEK_AGO}
  )`,
  verifiedAt: mindFact.verifiedAt,
  createdAt: mindFact.createdAt,
  updatedAt: mindFact.updatedAt,
};

type SelectedRow = {
  id: number;
  category: string;
  title: string;
  body: string;
  tags: string[];
  source: string;
  pinned: boolean;
  status: string;
  confidence: number;
  authorName: string | null;
  braindumpEntryId: number | null;
  linksOut: string;
  linksIn: string;
  recallsThisWeek: string;
  verifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function present(row: SelectedRow): MindFactRow {
  return {
    id: row.id,
    category: row.category as MindCategory,
    title: row.title,
    body: row.body,
    tags: row.tags,
    source: row.source as MindSource,
    pinned: row.pinned,
    status: row.status as MindStatus,
    confidence: row.confidence,
    authorName: row.authorName,
    braindumpEntryId: row.braindumpEntryId,
    linksOut: num(row.linksOut),
    linksIn: num(row.linksIn),
    recallsThisWeek: num(row.recallsThisWeek),
    verifiedAt: row.verifiedAt ? iso(row.verifiedAt) : null,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function baseQuery() {
  return db.select(columns).from(mindFact).leftJoin(user, eq(user.id, mindFact.authorUserId));
}

export interface ListMindFactFilters {
  category?: MindCategory;
  status?: MindStatus;
  tag?: string;
  search?: string;
  limit?: number;
}

export async function listMindFacts(
  projectId: number,
  filters: ListMindFactFilters = {},
): Promise<MindFactRow[]> {
  const where = [eq(mindFact.projectId, projectId)];
  if (filters.category) where.push(eq(mindFact.category, filters.category));
  else where.push(ne(mindFact.category, 'archive'));
  if (filters.status) where.push(eq(mindFact.status, filters.status));
  if (filters.tag) where.push(sql`${mindFact.tags} @> ${JSON.stringify([filters.tag])}::jsonb`);
  if (filters.search) {
    const pattern = `%${filters.search}%`;
    const match = or(ilike(mindFact.title, pattern), ilike(mindFact.body, pattern));
    if (match) where.push(match);
  }
  const rows = await baseQuery()
    .where(and(...where))
    .orderBy(desc(mindFact.pinned), desc(mindFact.confidence), desc(mindFact.updatedAt))
    .limit(filters.limit ?? 500);
  return rows.map(present);
}

export async function getMindFact(factId: number): Promise<MindFactRow | null> {
  const rows = await baseQuery().where(eq(mindFact.id, factId));
  return rows[0] ? present(rows[0]) : null;
}

export async function getMindFactProjectId(factId: number): Promise<number | null> {
  const rows = await db
    .select({ projectId: mindFact.projectId })
    .from(mindFact)
    .where(eq(mindFact.id, factId));
  return rows[0]?.projectId ?? null;
}

export interface NewMindFact {
  projectId: number;
  authorUserId: string | null;
  braindumpEntryId?: number | null;
  category: MindCategory;
  title: string;
  body: string;
  tags: string[];
  source: MindSource;
  confidence?: number;
  pinned?: boolean;
}

export async function createMindFact(input: NewMindFact): Promise<MindFactRow> {
  const [row] = await db
    .insert(mindFact)
    .values({
      projectId: input.projectId,
      authorUserId: input.authorUserId,
      braindumpEntryId: input.braindumpEntryId ?? null,
      category: input.category,
      title: input.title,
      body: input.body,
      tags: input.tags,
      source: input.source,
      confidence: input.confidence ?? 50,
      pinned: input.pinned ?? false,
    })
    .returning({ id: mindFact.id });
  const created = await getMindFact(row.id);
  if (!created) throw new Error('Mind fact disappeared right after insert');
  return created;
}

export interface MindFactPatch {
  category?: MindCategory;
  title?: string;
  body?: string;
  tags?: string[];
  pinned?: boolean;
  status?: MindStatus;
  confidence?: number;
}

export async function updateMindFact(
  factId: number,
  patch: MindFactPatch,
): Promise<MindFactRow | null> {
  const verifiedAt = patch.status === 'verified' ? { verifiedAt: new Date() } : {};
  await db
    .update(mindFact)
    .set({ ...patch, ...verifiedAt, updatedAt: new Date() })
    .where(eq(mindFact.id, factId));
  return getMindFact(factId);
}

export async function deleteMindFact(factId: number): Promise<void> {
  await db.delete(mindFact).where(eq(mindFact.id, factId));
}

// Both ends must sit in the same project: the route guard only proves the caller
// may touch `fromFactId`, so the target is checked here before anything is written.
export async function linkMindFacts(
  projectId: number,
  fromFactId: number,
  toFactId: number,
): Promise<boolean> {
  const target = await db
    .select({ id: mindFact.id })
    .from(mindFact)
    .where(and(eq(mindFact.id, toFactId), eq(mindFact.projectId, projectId)));
  if (!target[0]) return false;
  await db
    .insert(mindLink)
    .values({ fromFactId, toFactId })
    .onConflictDoNothing({ target: [mindLink.fromFactId, mindLink.toFactId] });
  return true;
}

export async function unlinkMindFacts(fromFactId: number, toFactId: number): Promise<void> {
  await db
    .delete(mindLink)
    .where(and(eq(mindLink.fromFactId, fromFactId), eq(mindLink.toFactId, toFactId)));
}

export async function listLinkedFacts(factId: number): Promise<MindFactRow[]> {
  const linked = await db
    .select({ id: mindLink.toFactId })
    .from(mindLink)
    .where(eq(mindLink.fromFactId, factId));
  const ids = linked.map((l) => l.id);
  if (ids.length === 0) return [];
  const rows = await baseQuery().where(inArray(mindFact.id, ids));
  return rows.map(present);
}

export interface RecallRow {
  id: number;
  factId: number | null;
  factTitle: string | null;
  actor: string;
  actorKind: 'agent' | 'user';
  query: string;
  createdAt: string;
}

export async function recordRecalls(
  projectId: number,
  factIds: number[],
  actor: string,
  actorKind: 'agent' | 'user',
  query: string,
): Promise<void> {
  if (factIds.length === 0) {
    await db.insert(mindRecall).values({ projectId, factId: null, actor, actorKind, query });
    return;
  }
  await db
    .insert(mindRecall)
    .values(factIds.map((factId) => ({ projectId, factId, actor, actorKind, query })));
}

export async function listRecentRecalls(projectId: number, limit: number): Promise<RecallRow[]> {
  const rows = await db
    .select({
      id: mindRecall.id,
      factId: mindRecall.factId,
      factTitle: mindFact.title,
      actor: mindRecall.actor,
      actorKind: mindRecall.actorKind,
      query: mindRecall.query,
      createdAt: mindRecall.createdAt,
    })
    .from(mindRecall)
    .leftJoin(mindFact, eq(mindFact.id, mindRecall.factId))
    .where(eq(mindRecall.projectId, projectId))
    .orderBy(desc(mindRecall.createdAt))
    .limit(limit);
  return rows.map((row) => ({
    id: row.id,
    factId: row.factId,
    factTitle: row.factTitle,
    actor: row.actor,
    actorKind: row.actorKind as 'agent' | 'user',
    query: row.query,
    createdAt: iso(row.createdAt),
  }));
}

export interface MindOverview {
  totalFacts: number;
  factsThisWeek: number;
  links: number;
  recallsToday: number;
  byCategory: { category: MindCategory | 'archive'; count: number }[];
  daily: { date: string; count: number }[];
  mostLinked: {
    id: number;
    title: string;
    category: MindCategory;
    linksIn: number;
    linksOut: number;
  }[];
  health: {
    verified: number;
    conflicted: number;
    stale: number;
    orphans: number;
  };
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export async function getMindOverview(
  projectId: number,
  windowDays: number,
): Promise<MindOverview> {
  // Both bounds go into raw sql fragments, where there is no column to infer a
  // mapper from, so they are passed as ISO text with an explicit cast.
  const staleBefore = daysAgo(STALE_AFTER_DAYS).toISOString();
  const startOfTodayDate = new Date();
  startOfTodayDate.setUTCHours(0, 0, 0, 0);
  const startOfToday = startOfTodayDate.toISOString();
  const inProject = eq(mindFact.projectId, projectId);

  const [totals, categoryRows, dailyRows, hubRows, healthRows] = await Promise.all([
    db
      .select({
        total: sql<string>`count(*)`,
        thisWeek: sql<string>`count(*) filter (where ${mindFact.createdAt} >= ${WEEK_AGO})`,
        links: sql<string>`(
          select count(*) from ${mindLink} l
          join ${mindFact} f on f.id = l.from_fact_id
          where f.project_id = ${projectId}
        )`,
        recallsToday: sql<string>`(
          select count(*) from ${mindRecall} r
          where r.project_id = ${projectId} and r.created_at >= ${startOfToday}::timestamptz
        )`,
      })
      .from(mindFact)
      .where(inProject),
    db
      .select({ category: mindFact.category, count: sql<string>`count(*)` })
      .from(mindFact)
      .where(inProject)
      .groupBy(mindFact.category),
    db
      .select({
        date: sql<string>`to_char(${mindRecall.createdAt} at time zone 'UTC', 'YYYY-MM-DD')`,
        count: sql<string>`count(*)`,
      })
      .from(mindRecall)
      .where(
        and(
          eq(mindRecall.projectId, projectId),
          gte(mindRecall.createdAt, daysAgo(windowDays - 1)),
        ),
      )
      .groupBy(sql`to_char(${mindRecall.createdAt} at time zone 'UTC', 'YYYY-MM-DD')`),
    db
      .select({
        id: mindFact.id,
        title: mindFact.title,
        category: mindFact.category,
        linksIn: sql<string>`(select count(*) from ${mindLink} l where l.to_fact_id = ${mindFact.id})`,
        linksOut: sql<string>`(select count(*) from ${mindLink} l where l.from_fact_id = ${mindFact.id})`,
      })
      .from(mindFact)
      .where(inProject)
      .orderBy(
        desc(
          sql`(select count(*) from ${mindLink} l where l.to_fact_id = ${mindFact.id} or l.from_fact_id = ${mindFact.id})`,
        ),
      )
      .limit(5),
    db
      .select({
        verified: sql<string>`count(*) filter (where ${mindFact.status} = 'verified')`,
        conflicted: sql<string>`count(*) filter (where ${mindFact.status} = 'conflicted')`,
        stale: sql<string>`count(*) filter (where ${mindFact.updatedAt} < ${staleBefore}::timestamptz)`,
        orphans: sql<string>`count(*) filter (where not exists (
          select 1 from ${mindLink} l
          where l.to_fact_id = ${mindFact.id} or l.from_fact_id = ${mindFact.id}
        ))`,
      })
      .from(mindFact)
      .where(inProject),
  ]);

  const byDate = new Map(dailyRows.map((r) => [r.date, num(r.count)]));
  const daily: { date: string; count: number }[] = [];
  for (let i = windowDays - 1; i >= 0; i--) {
    const date = daysAgo(i).toISOString().slice(0, 10);
    daily.push({ date, count: byDate.get(date) ?? 0 });
  }

  return {
    totalFacts: num(totals[0]?.total ?? 0),
    factsThisWeek: num(totals[0]?.thisWeek ?? 0),
    links: num(totals[0]?.links ?? 0),
    recallsToday: num(totals[0]?.recallsToday ?? 0),
    byCategory: categoryRows.map((r) => ({
      category: r.category as MindCategory,
      count: num(r.count),
    })),
    daily,
    mostLinked: hubRows.map((r) => ({
      id: r.id,
      title: r.title,
      category: r.category as MindCategory,
      linksIn: num(r.linksIn),
      linksOut: num(r.linksOut),
    })),
    health: {
      verified: num(healthRows[0]?.verified ?? 0),
      conflicted: num(healthRows[0]?.conflicted ?? 0),
      stale: num(healthRows[0]?.stale ?? 0),
      orphans: num(healthRows[0]?.orphans ?? 0),
    },
  };
}

// What an agent gets when it asks the memory a question: the pinned "read first"
// facts, then whatever matches the query, most trusted first. Archived facts are
// never returned — archiving is how the operator takes a statement out of play.
export async function recallMindFacts(
  projectId: number,
  query: string,
  limit: number,
): Promise<MindFactRow[]> {
  const where = [eq(mindFact.projectId, projectId), ne(mindFact.category, 'archive')];
  const trimmed = query.trim();
  if (trimmed.length > 0) {
    const pattern = `%${trimmed}%`;
    const match = or(
      ilike(mindFact.title, pattern),
      ilike(mindFact.body, pattern),
      sql`${mindFact.tags}::text ilike ${pattern}`,
    );
    // Pinned facts lead every answer, matched or not.
    const scoped = match ? or(match, eq(mindFact.pinned, true)) : undefined;
    if (scoped) where.push(scoped);
  }
  const rows = await baseQuery()
    .where(and(...where))
    .orderBy(desc(mindFact.pinned), desc(mindFact.confidence), desc(mindFact.updatedAt))
    .limit(limit);
  return rows.map(present);
}

// Facts nothing has touched for STALE_AFTER_DAYS, oldest first — the queue behind
// "facts going stale" in memory health.
export async function listStaleMindFacts(projectId: number, limit: number): Promise<MindFactRow[]> {
  const rows = await baseQuery()
    .where(
      and(eq(mindFact.projectId, projectId), lt(mindFact.updatedAt, daysAgo(STALE_AFTER_DAYS))),
    )
    .orderBy(mindFact.updatedAt)
    .limit(limit);
  return rows.map(present);
}
