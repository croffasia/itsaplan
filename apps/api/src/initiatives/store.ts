import { db, initiative, initiativeLabel, issue, label, projectColumn, user } from '@repo/db';
import { and, asc, desc, eq, ilike, inArray, sql } from 'drizzle-orm';
import { labelNames } from '../issues/activity';
import { getMembership } from '../members/store';
import { HttpError, iso, num } from '../shared/lib';
import { computeHealth, type Health } from './health';
import { recordActivity, logInitiativeUpdate, type InitiativeSnapshot } from './activity';

// Data access for initiatives: a project-scoped grouping of issues. Issues link
// to an initiative through issue.initiative_id. status is a fixed lifecycle enum;
// progress and health are derived from the linked issues' states and are not
// stored (see health.ts).

export interface InitiativeProgress {
  completed: number;
  canceled: number;
  total: number;
}

export interface InitiativeRow {
  id: number;
  projectId: number;
  title: string;
  description: string;
  status: string;
  ownerUserId: string | null;
  priority: string | null;
  startDate: string | null;
  targetDate: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
  labelIds: number[];
  progress: InitiativeProgress;
  health: Health | null;
}

// Issue counts per initiative, grouped by the linked issues' state type. Empty
// entries (an initiative with no issues) are simply absent from the map.
async function countsFor(initiativeIds: number[]): Promise<Map<number, InitiativeProgress>> {
  const out = new Map<number, InitiativeProgress>();
  if (initiativeIds.length === 0) return out;
  const rows = await db
    .select({
      initiativeId: issue.initiativeId,
      total: sql<number>`count(*)`,
      completed: sql<number>`count(*) filter (where ${projectColumn.stateType} = 'completed')`,
      canceled: sql<number>`count(*) filter (where ${projectColumn.stateType} = 'canceled')`,
    })
    .from(issue)
    .innerJoin(projectColumn, eq(projectColumn.id, issue.columnId))
    .where(inArray(issue.initiativeId, initiativeIds))
    .groupBy(issue.initiativeId);
  for (const r of rows) {
    if (r.initiativeId == null) continue;
    out.set(r.initiativeId, {
      total: Number(r.total),
      completed: Number(r.completed),
      canceled: Number(r.canceled),
    });
  }
  return out;
}

// Label ids per initiative, in one query.
async function labelsFor(initiativeIds: number[]): Promise<Map<number, number[]>> {
  const out = new Map<number, number[]>();
  if (initiativeIds.length === 0) return out;
  const rows = await db
    .select({ initiativeId: initiativeLabel.initiativeId, labelId: initiativeLabel.labelId })
    .from(initiativeLabel)
    .where(inArray(initiativeLabel.initiativeId, initiativeIds));
  for (const r of rows) {
    const list = out.get(r.initiativeId);
    if (list) list.push(r.labelId);
    else out.set(r.initiativeId, [r.labelId]);
  }
  return out;
}

function mapInitiative(
  row: typeof initiative.$inferSelect,
  labelIds: number[],
  progress: InitiativeProgress,
): InitiativeRow {
  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    description: row.description,
    status: row.status,
    ownerUserId: row.ownerUserId,
    priority: row.priority,
    startDate: row.startDate,
    targetDate: row.targetDate,
    position: num(row.position),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    labelIds,
    progress,
    health: computeHealth({
      ...progress,
      startDate: row.startDate,
      targetDate: row.targetDate,
      createdAt: iso(row.createdAt),
    }),
  };
}

const EMPTY_PROGRESS: InitiativeProgress = { completed: 0, canceled: 0, total: 0 };

// Sortable columns. progress and health are derived per row after the query, so
// they are not sortable at the database level.
export type InitiativeSort = 'title' | 'priority' | 'targetDate' | 'owner';

export interface ListInitiativesOpts {
  statuses?: string[];
  search?: string;
  sort?: InitiativeSort;
  dir?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface InitiativeListPage {
  items: InitiativeRow[];
  total: number;
}

// Priority is a text column with no natural sort order; rank it by severity so a
// priority sort reads urgent → low, with unset last.
const PRIORITY_ORDER = sql`case ${initiative.priority}
  when 'urgent' then 0 when 'high' then 1 when 'medium' then 2 when 'low' then 3 else 4 end`;

function orderExpr(sort: InitiativeSort) {
  switch (sort) {
    case 'title':
      return initiative.title;
    case 'priority':
      return PRIORITY_ORDER;
    case 'targetDate':
      return initiative.targetDate;
    case 'owner':
      // Sort by the owner's display name, not the opaque user id.
      return sql`(select ${user.name} from ${user} where ${user.id} = ${initiative.ownerUserId})`;
  }
}

export async function listInitiatives(
  projectId: number,
  opts: ListInitiativesOpts = {},
): Promise<InitiativeListPage> {
  const conds = [eq(initiative.projectId, projectId)];
  if (opts.statuses && opts.statuses.length) {
    conds.push(inArray(initiative.status, opts.statuses));
  }
  if (opts.search && opts.search.trim()) {
    conds.push(ilike(initiative.title, `%${opts.search.trim()}%`));
  }
  const where = and(...conds);

  // A chosen sort orders by that column (nulls last); the default is the manual
  // position. desc(id) breaks ties for a stable page order.
  const orderBy = opts.sort
    ? [
        sql`${orderExpr(opts.sort)} ${opts.dir === 'desc' ? sql`desc` : sql`asc`} nulls last`,
        desc(initiative.id),
      ]
    : [asc(initiative.position), desc(initiative.id)];

  const q = db
    .select()
    .from(initiative)
    .where(where)
    .orderBy(...orderBy);
  const rows =
    opts.limit !== undefined ? await q.limit(opts.limit).offset(opts.offset ?? 0) : await q;

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)` })
    .from(initiative)
    .where(where);

  const ids = rows.map((r) => r.id);
  const [counts, labels] = await Promise.all([countsFor(ids), labelsFor(ids)]);
  return {
    items: rows.map((row) =>
      mapInitiative(row, labels.get(row.id) ?? [], counts.get(row.id) ?? EMPTY_PROGRESS),
    ),
    total: Number(total),
  };
}

export interface InitiativeStatusCounts {
  total: number;
  proposed: number;
  planned: number;
  active: number;
  completed: number;
  canceled: number;
}

// Per-status row counts for the whole project, for the list's status tabs. Kept
// separate from listInitiatives so the tab counts stay correct under paging.
export async function initiativeStatusCounts(projectId: number): Promise<InitiativeStatusCounts> {
  const rows = await db
    .select({ status: initiative.status, c: sql<number>`count(*)` })
    .from(initiative)
    .where(eq(initiative.projectId, projectId))
    .groupBy(initiative.status);
  const out: InitiativeStatusCounts = {
    total: 0,
    proposed: 0,
    planned: 0,
    active: 0,
    completed: 0,
    canceled: 0,
  };
  for (const r of rows) {
    const n = Number(r.c);
    out.total += n;
    if (r.status === 'proposed') out.proposed = n;
    else if (r.status === 'planned') out.planned = n;
    else if (r.status === 'active') out.active = n;
    else if (r.status === 'completed') out.completed = n;
    else if (r.status === 'canceled') out.canceled = n;
  }
  return out;
}

export async function getInitiative(id: number): Promise<InitiativeRow | null> {
  const rows = await db.select().from(initiative).where(eq(initiative.id, id));
  if (!rows[0]) return null;
  const [counts, labels] = await Promise.all([countsFor([id]), labelsFor([id])]);
  return mapInitiative(rows[0], labels.get(id) ?? [], counts.get(id) ?? EMPTY_PROGRESS);
}

// The project an initiative belongs to, or null if it does not exist. Used by the
// access check on routes that address an initiative by its own id.
export async function getInitiativeProjectId(id: number): Promise<number | null> {
  const rows = await db
    .select({ projectId: initiative.projectId })
    .from(initiative)
    .where(eq(initiative.id, id));
  return rows[0]?.projectId ?? null;
}

export interface NewInitiativeInput {
  title: string;
  description?: string;
  status?: string;
  ownerUserId?: string | null;
  priority?: string | null;
  startDate?: string | null;
  targetDate?: string | null;
  labelIds?: number[];
}

async function assertInitiativeOwner(
  projectId: number,
  ownerUserId?: string | null,
): Promise<void> {
  if (!ownerUserId) return;
  if (!(await getMembership(projectId, ownerUserId))) {
    throw new HttpError(400, 'Initiative owner must be a project member');
  }
}

async function assertInitiativeLabels(projectId: number, labelIds?: number[]): Promise<void> {
  const ids = [...new Set(labelIds ?? [])];
  if (ids.length === 0) return;
  const rows = await db
    .select({ id: label.id })
    .from(label)
    .where(and(eq(label.projectId, projectId), inArray(label.id, ids)));
  if (rows.length !== ids.length) {
    throw new HttpError(400, 'Initiative labels must belong to this project');
  }
}

async function assertInitiativeReferences(
  projectId: number,
  input: { ownerUserId?: string | null; labelIds?: number[] },
): Promise<void> {
  await Promise.all([
    assertInitiativeOwner(projectId, input.ownerUserId),
    assertInitiativeLabels(projectId, input.labelIds),
  ]);
}

export async function createInitiative(
  projectId: number,
  input: NewInitiativeInput,
  actorUserId?: string | null,
): Promise<InitiativeRow> {
  await assertInitiativeReferences(projectId, input);
  const [posRow] = await db
    .select({ pos: sql<number>`COALESCE(MAX(${initiative.position}), 0) + 1000` })
    .from(initiative)
    .where(eq(initiative.projectId, projectId));
  const [row] = await db
    .insert(initiative)
    .values({
      projectId,
      title: input.title,
      description: input.description ?? '',
      status: input.status ?? 'planned',
      ownerUserId: input.ownerUserId ?? null,
      priority: input.priority ?? null,
      startDate: input.startDate ?? null,
      targetDate: input.targetDate ?? null,
      position: Number(posRow.pos),
    })
    .returning({ id: initiative.id });
  await recordActivity(row.id, [{ action: 'created' }], actorUserId);
  if (input.labelIds?.length) await setInitiativeLabels(row.id, input.labelIds, actorUserId);
  return (await getInitiative(row.id))!;
}

export interface InitiativePatch {
  title?: string;
  description?: string;
  status?: string;
  ownerUserId?: string | null;
  priority?: string | null;
  startDate?: string | null;
  targetDate?: string | null;
  labelIds?: number[];
}

function snapshot(row: typeof initiative.$inferSelect): InitiativeSnapshot {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    ownerUserId: row.ownerUserId,
    priority: row.priority,
    startDate: row.startDate,
    targetDate: row.targetDate,
  };
}

// Addressed by its own id (the route's entity guard already resolved the owning
// project and asserted permission). Returns null if the initiative does not
// exist, which the route maps to a 404.
export async function updateInitiative(
  id: number,
  patch: InitiativePatch,
  actorUserId?: string | null,
): Promise<InitiativeRow | null> {
  const beforeRows = await db.select().from(initiative).where(eq(initiative.id, id));
  const before = beforeRows[0];
  if (!before) return null;
  await assertInitiativeReferences(before.projectId, patch);

  const set: Partial<typeof initiative.$inferInsert> = {};
  if (patch.title !== undefined) set.title = patch.title;
  if (patch.description !== undefined) set.description = patch.description;
  if (patch.status !== undefined) set.status = patch.status;
  if (patch.ownerUserId !== undefined) set.ownerUserId = patch.ownerUserId;
  if (patch.priority !== undefined) set.priority = patch.priority;
  if (patch.startDate !== undefined) set.startDate = patch.startDate;
  if (patch.targetDate !== undefined) set.targetDate = patch.targetDate;

  if (Object.keys(set).length > 0) {
    set.updatedAt = sql`now()` as unknown as Date;
    const [after] = await db.update(initiative).set(set).where(eq(initiative.id, id)).returning();
    await logInitiativeUpdate(snapshot(before), snapshot(after), actorUserId);
  }
  if (patch.labelIds !== undefined) {
    await setInitiativeLabels(id, patch.labelIds, actorUserId);
  }
  return getInitiative(id);
}

// Linked issues keep existing (issue.initiative_id is set null by the FK); the
// initiative's own activity rows and label links cascade.
export async function deleteInitiative(id: number): Promise<void> {
  await db.delete(initiative).where(eq(initiative.id, id));
}

// Replaces the initiative's full label set (not an add/remove diff) and logs the
// added/removed labels to the activity feed. Bumps updated_at so initiativeRev
// moves.
async function setInitiativeLabels(
  initiativeId: number,
  labelIds: number[],
  actorUserId?: string | null,
): Promise<void> {
  const beforeRows = await db
    .select({ labelId: initiativeLabel.labelId })
    .from(initiativeLabel)
    .where(eq(initiativeLabel.initiativeId, initiativeId));
  const before = beforeRows.map((r) => r.labelId);
  const next = [...new Set(labelIds)];

  await db.delete(initiativeLabel).where(eq(initiativeLabel.initiativeId, initiativeId));
  if (next.length) {
    await db
      .insert(initiativeLabel)
      .values(next.map((labelId) => ({ initiativeId, labelId })))
      .onConflictDoNothing();
  }

  const added = next.filter((x) => !before.includes(x));
  const removed = before.filter((x) => !next.includes(x));
  if (added.length === 0 && removed.length === 0) return;

  await db
    .update(initiative)
    .set({ updatedAt: sql`now()` })
    .where(eq(initiative.id, initiativeId));

  const names = await labelNames([...added, ...removed]);
  const events = [];
  for (const labelId of added)
    events.push({ action: 'label_add', toText: names.get(labelId) ?? null });
  for (const labelId of removed)
    events.push({ action: 'label_remove', fromText: names.get(labelId) ?? null });
  await recordActivity(initiativeId, events, actorUserId);
}

// One initiative's change marker: moves on any initiative-level event, any
// activity of a linked issue, and any in-place edit (updated_at). Clients poll
// this and refetch the detail/feed only when it changes.
export async function initiativeRev(id: number): Promise<string> {
  const [row] = await db
    .select({
      a: sql<
        number | null
      >`(select max(id) from issue_activity where initiative_id = ${id} or issue_id in (select id from issue where initiative_id = ${id}))`,
      u: sql<string>`${initiative.updatedAt}::text`,
    })
    .from(initiative)
    .where(eq(initiative.id, id));
  return row ? `${row.a ?? 0}:${row.u}` : '0:';
}
