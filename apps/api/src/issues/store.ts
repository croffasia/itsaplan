import {
  db,
  project as projectTable,
  issue,
  issueActivity,
  issueLabel,
  issueLink,
  label,
  projectColumn,
  issueType,
  issueFieldValue,
  issueFieldOption,
  issueAttachment,
  customField,
  customFieldOption,
  initiative,
  cycle,
} from '@repo/db';
import {
  and,
  eq,
  exists,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lte,
  notInArray,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import type { IssueQuery } from '../ai-agents/issue-query';
import { iso, num, HttpError } from '../shared/lib';
import type { ProjectRow } from '../projects/store';
import { getCustomFieldById, type CustomFieldType } from '../custom-fields/store';
import {
  recordActivity,
  recordActivityEntries,
  logIssueUpdate,
  labelNames,
  type ActivityInput,
  type IssueSnapshot,
} from './activity';
import { autoWatchIssue } from './watchers';
import { mapAttachment, type AttachmentRow } from '../attachments/store';
import { notifyIssueChange } from '../notifications/store';
import { emitWebhookEvent } from '../webhooks/emit';
import { getAssignTriggerAgent, isProjectAgent } from '../ai-agents/store';
import { deleteThreadsWhere } from '../ai-agents/runtime/memory';
import { getInitiativeProjectId } from '../initiatives/store';
import { getCycleRef } from '../cycles/store';
import { getMembership } from '../members/store';
import { enqueueAgentRun } from '../ai-agents/run-queue';

// Data access for issues and their per-issue data: labels, custom field values,
// and selected options. The human identifier (e.g. "MKT-42") is the project key
// plus the issue's project-scoped sequence number.

// Compact custom field value for the work items payload: the scalar value (null for
// select/multi_select and unset fields) and the selected option ids.
export interface IssueFieldValueEntry {
  fieldId: number;
  value: string | number | boolean | null;
  optionIds: number[];
}

export interface IssueRow {
  id: number;
  projectId: number;
  // Project-scoped sequence number (the "42" in "MKT-42"). Used to address the
  // issue by its human number in URLs (/project/MKT/issue/42).
  sequenceNumber: number;
  identifier: string;
  typeId: number | null;
  // The initiative this issue is linked to, expanded to id + title for rendering,
  // or null. Filled by attachGroupings; mapIssue alone leaves it null.
  initiative: { id: number; title: string } | null;
  // The cycle this issue is planned into, expanded to id + name for rendering, or
  // null. Filled by attachGroupings; mapIssue alone leaves it null.
  cycle: { id: number; name: string } | null;
  assigneeUserId: string | null;
  delegateUserId: string | null;
  columnId: number;
  // The issue this one is a subtask of, or null when it stands on its own. One
  // level deep: an issue with a parent cannot itself have subtasks.
  parentId: number | null;
  title: string;
  description: string;
  priority: string | null;
  startDate: string | null;
  dueDate: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
  // When the issue was archived (hidden from the board but kept), or null when it
  // is active. Set by the archive action or the worker's auto-archive sweep.
  archivedAt: string | null;
  // When the issue entered its current column: the newest status-change activity,
  // or createdAt when it has never changed column. Lets the board show how long an
  // issue has sat in its current state. Populated by listIssues/getIssue; mapIssue
  // alone leaves it at createdAt.
  statusSince: string;
  // Unguessable token for the public read-only share link, or null when the issue
  // is not shared. Populated by mapIssue from the row.
  shareToken: string | null;
  // Whether that link exposes the issue in full (assignees, labels, custom fields,
  // activity) or only its title, description, state, type, priority, dates,
  // subtasks and links.
  shareExtended: boolean;
  labelIds: number[];
  // Custom field values set on this issue, one entry per field that has a scalar
  // value or selected options (unset fields are omitted). Included so the planner
  // UI can filter by custom fields without a per-issue fetch. Only listIssues
  // populates this; mapIssue alone leaves it empty.
  fieldValues: IssueFieldValueEntry[];
}

function mapIssue(row: typeof issue.$inferSelect, projectKey: string): IssueRow {
  return {
    id: row.id,
    projectId: row.projectId,
    sequenceNumber: row.sequenceNumber,
    identifier: `${projectKey}-${row.sequenceNumber}`,
    typeId: row.typeId,
    initiative: null,
    cycle: null,
    assigneeUserId: row.assigneeUserId,
    delegateUserId: row.delegateUserId,
    columnId: row.columnId,
    parentId: row.parentId,
    title: row.title,
    description: row.description,
    priority: row.priority,
    startDate: row.startDate,
    dueDate: row.dueDate,
    position: num(row.position),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    archivedAt: row.archivedAt ? iso(row.archivedAt) : null,
    statusSince: iso(row.createdAt),
    shareToken: row.shareToken,
    shareExtended: row.shareExtended,
    labelIds: [],
    fieldValues: [],
  };
}

// Sets each issue's statusSince to the newest status-change activity's timestamp,
// leaving the createdAt default (set by mapIssue) for issues that never changed
// column. One grouped query for the whole set. Mutates the passed issues in place.
async function attachStatusSince(issues: IssueRow[]): Promise<void> {
  if (issues.length === 0) return;
  const rows = await db
    .select({
      issueId: issueActivity.issueId,
      // A raw sql aggregate is not mapped to a Date by Drizzle (that mapping is
      // keyed on a column type), so this comes back as the Postgres timestamp
      // string; parse it before iso(), the same way Drizzle decodes a timestamp
      // column.
      lastStatusAt: sql<string | null>`max(${issueActivity.createdAt})`,
    })
    .from(issueActivity)
    .where(
      and(
        inArray(
          issueActivity.issueId,
          issues.map((i) => i.id),
        ),
        eq(issueActivity.action, 'status'),
      ),
    )
    .groupBy(issueActivity.issueId);
  const byIssue = new Map<number, string>();
  for (const r of rows)
    if (r.issueId != null && r.lastStatusAt) byIssue.set(r.issueId, iso(new Date(r.lastStatusAt)));
  for (const i of issues) i.statusSince = byIssue.get(i.id) ?? i.statusSince;
}

// The subset of issue columns the change log diffs.
function snapshot(row: IssueRow): IssueSnapshot {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    columnId: row.columnId,
    typeId: row.typeId,
    initiativeId: row.initiative?.id ?? null,
    cycleId: row.cycle?.id ?? null,
    assigneeUserId: row.assigneeUserId,
    delegateUserId: row.delegateUserId,
    priority: row.priority,
    startDate: row.startDate,
    dueDate: row.dueDate,
  };
}

export async function listIssues(project: ProjectRow): Promise<IssueRow[]> {
  const rows = await db
    .select()
    .from(issue)
    .where(and(eq(issue.projectId, project.id), isNull(issue.archivedAt)))
    .orderBy(issue.columnId, issue.position);
  const issues = rows.map((row) => mapIssue(row, project.key));
  await attachLabels(issues);
  await attachFieldValues(issues);
  await attachStatusSince(issues);
  await attachGroupings(issues);
  return issues;
}

// The project's archived issues, newest archived first. The archive view lists
// these so an owner can restore one. Same per-issue enrichment as the board.
export async function listArchivedIssues(project: ProjectRow): Promise<IssueRow[]> {
  const rows = await db
    .select()
    .from(issue)
    .where(and(eq(issue.projectId, project.id), isNotNull(issue.archivedAt)))
    .orderBy(sql`${issue.archivedAt} desc`);
  const issues = rows.map((row) => mapIssue(row, project.key));
  await attachLabels(issues);
  await attachFieldValues(issues);
  await attachStatusSince(issues);
  await attachGroupings(issues);
  return issues;
}

// A light issue result for search and list: the fields the command palette and the
// agent's search_issues / list_issues tools need to list and open a match. No
// description (which may embed large data URIs) and no field values, so the payload
// stays small.
export interface IssueSearchHit {
  id: number;
  sequenceNumber: number;
  identifier: string;
  title: string;
  columnId: number;
  typeId: number | null;
  initiativeId: number | null;
  cycleId: number | null;
  parentId: number | null;
  assigneeUserId: string | null;
  delegateUserId: string | null;
  priority: string | null;
  dueDate: string | null;
  labelIds: number[];
  archived: boolean;
}

// Escapes LIKE metacharacters so the query is matched literally (Postgres LIKE uses
// '\' as the default escape character).
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

// Server-side issue read backing two routes: text search (search_issues) and the
// filtered list (list_issues). Text search (filters.query) matches, case-
// insensitively, the title, description, the issue number (a bare number, or
// "KEY-42" for this project), scalar custom field text values, and
// select/multi_select option labels. The other fields apply as exact filters (used
// by list_issues). includeArchived adds archived issues to the result (search always
// sets it; list defaults to active only).
export async function searchIssues(
  project: ProjectRow,
  filters: IssueQuery,
  opts: { includeArchived?: boolean } = {},
): Promise<IssueSearchHit[]> {
  const conds: SQL[] = [eq(issue.projectId, project.id)];
  if (!opts.includeArchived) conds.push(isNull(issue.archivedAt));

  const raw = filters.query?.trim();
  let seqMatch: number | null = null;
  if (raw) {
    const pattern = `%${escapeLike(raw)}%`;
    // Recognise the issue number: a bare number, or "KEY-42" whose key matches this
    // project. Matched against sequence_number (the identifier is not a column).
    if (/^\d+$/.test(raw)) {
      seqMatch = Number(raw);
    } else {
      const m = raw.match(/^([A-Za-z][A-Za-z0-9]*)-(\d+)$/);
      if (m && m[1].toLowerCase() === project.key.toLowerCase()) seqMatch = Number(m[2]);
    }
    const textConds: SQL[] = [
      ilike(issue.title, pattern),
      ilike(issue.description, pattern),
      exists(
        db
          .select({ one: sql`1` })
          .from(issueFieldValue)
          .where(
            and(eq(issueFieldValue.issueId, issue.id), ilike(issueFieldValue.valueText, pattern)),
          ),
      ),
      exists(
        db
          .select({ one: sql`1` })
          .from(issueFieldOption)
          .innerJoin(customFieldOption, eq(customFieldOption.id, issueFieldOption.optionId))
          .where(
            and(eq(issueFieldOption.issueId, issue.id), ilike(customFieldOption.value, pattern)),
          ),
      ),
    ];
    if (seqMatch !== null) textConds.push(eq(issue.sequenceNumber, seqMatch));
    conds.push(or(...textConds)!);
  }

  // Exact filters, mirroring matchesIssue: undefined skips the filter, null matches
  // rows where the column is null, a value matches equality.
  if (filters.columnId !== undefined) conds.push(eq(issue.columnId, filters.columnId));
  if (filters.typeId !== undefined)
    conds.push(filters.typeId === null ? isNull(issue.typeId) : eq(issue.typeId, filters.typeId));
  if (filters.initiativeId !== undefined)
    conds.push(
      filters.initiativeId === null
        ? isNull(issue.initiativeId)
        : eq(issue.initiativeId, filters.initiativeId),
    );
  if (filters.cycleId !== undefined)
    conds.push(
      filters.cycleId === null ? isNull(issue.cycleId) : eq(issue.cycleId, filters.cycleId),
    );
  if (filters.parentId !== undefined)
    conds.push(
      filters.parentId === null ? isNull(issue.parentId) : eq(issue.parentId, filters.parentId),
    );
  if (filters.assigneeUserId !== undefined)
    conds.push(
      filters.assigneeUserId === null
        ? isNull(issue.assigneeUserId)
        : eq(issue.assigneeUserId, filters.assigneeUserId),
    );
  if (filters.delegateUserId !== undefined)
    conds.push(
      filters.delegateUserId === null
        ? isNull(issue.delegateUserId)
        : eq(issue.delegateUserId, filters.delegateUserId),
    );
  if (filters.priority !== undefined)
    conds.push(
      filters.priority === null ? isNull(issue.priority) : eq(issue.priority, filters.priority),
    );
  // labelIds is AND: the issue must carry every supplied label.
  for (const labelId of filters.labelIds ?? []) {
    conds.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(issueLabel)
          .where(and(eq(issueLabel.issueId, issue.id), eq(issueLabel.labelId, labelId))),
      ),
    );
  }
  // A null due date never falls in a range, so gte/lte alone exclude it.
  if (filters.dueFrom !== undefined) conds.push(gte(issue.dueDate, filters.dueFrom));
  if (filters.dueTo !== undefined) conds.push(lte(issue.dueDate, filters.dueTo));

  // Exact number match first (if any), then most recently updated.
  const orderBy =
    seqMatch !== null
      ? [
          sql`case when ${issue.sequenceNumber} = ${seqMatch} then 0 else 1 end`,
          sql`${issue.updatedAt} desc`,
        ]
      : [sql`${issue.updatedAt} desc`];

  const base = db
    .select({
      id: issue.id,
      sequenceNumber: issue.sequenceNumber,
      typeId: issue.typeId,
      initiativeId: issue.initiativeId,
      cycleId: issue.cycleId,
      parentId: issue.parentId,
      assigneeUserId: issue.assigneeUserId,
      delegateUserId: issue.delegateUserId,
      columnId: issue.columnId,
      title: issue.title,
      priority: issue.priority,
      dueDate: issue.dueDate,
      archivedAt: issue.archivedAt,
    })
    .from(issue)
    .where(and(...conds))
    .orderBy(...orderBy);
  const rows = filters.limit !== undefined ? await base.limit(filters.limit) : await base;

  const hits: IssueSearchHit[] = rows.map((r) => ({
    id: r.id,
    sequenceNumber: r.sequenceNumber,
    identifier: `${project.key}-${r.sequenceNumber}`,
    title: r.title,
    columnId: r.columnId,
    typeId: r.typeId,
    initiativeId: r.initiativeId,
    cycleId: r.cycleId,
    parentId: r.parentId,
    assigneeUserId: r.assigneeUserId,
    delegateUserId: r.delegateUserId,
    priority: r.priority,
    dueDate: r.dueDate,
    labelIds: [],
    archived: r.archivedAt !== null,
  }));
  await attachLabels(hits);
  return hits;
}

// Archives an issue: sets archived_at so it drops off the board and lists, keeping
// the row for restore. Idempotent (archiving an archived issue is a no-op re-stamp
// avoided by the archived_at guard). Records a feed entry. Returns the updated
// issue, or null if it does not exist.
//
// The agents' conversation threads for the issue are deleted with it. Archiving is
// reversible and this is not: a restored issue starts with empty agent memory.
export async function archiveIssue(
  id: number,
  actorUserId?: string | null,
): Promise<IssueRow | null> {
  const [row] = await db
    .update(issue)
    .set({ archivedAt: sql`now()` })
    .where(and(eq(issue.id, id), isNull(issue.archivedAt)))
    .returning({ id: issue.id });
  if (!row) {
    // Either not found, or already archived. Distinguish so a missing issue 404s.
    return getIssue(id);
  }
  await recordActivity(id, [{ action: 'archived' }], actorUserId);
  await deleteThreadsWhere({ issueId: id });
  return getIssue(id);
}

// Restores an archived issue back onto the board (archived_at -> null). Records a
// feed entry. Returns the updated issue, or null if it does not exist.
export async function restoreIssue(
  id: number,
  actorUserId?: string | null,
): Promise<IssueRow | null> {
  const [row] = await db
    .update(issue)
    .set({ archivedAt: null })
    .where(and(eq(issue.id, id), isNotNull(issue.archivedAt)))
    .returning({ id: issue.id });
  if (!row) return getIssue(id);
  await recordActivity(id, [{ action: 'restored' }], actorUserId);
  return getIssue(id);
}

// Expands what an issue is planned under — its initiative and its cycle — to
// { id, title } / { id, name } in place. Both hang off the same issue rows, so one
// query carries them; an issue linked to neither keeps the nulls mapIssue set.
// Rendering those names on a board card needs no separate scaffold lookup this way.
async function attachGroupings(issues: IssueRow[]): Promise<void> {
  if (issues.length === 0) return;
  const rows = await db
    .select({
      issueId: issue.id,
      initiativeId: initiative.id,
      initiativeTitle: initiative.title,
      cycleId: cycle.id,
      cycleName: cycle.name,
    })
    .from(issue)
    .leftJoin(initiative, eq(initiative.id, issue.initiativeId))
    .leftJoin(cycle, eq(cycle.id, issue.cycleId))
    .where(
      and(
        inArray(
          issue.id,
          issues.map((i) => i.id),
        ),
        or(isNotNull(issue.initiativeId), isNotNull(issue.cycleId)),
      ),
    );
  const byIssue = new Map(rows.map((r) => [r.issueId, r]));
  for (const i of issues) {
    const r = byIssue.get(i.id);
    i.initiative =
      r && r.initiativeId != null ? { id: r.initiativeId, title: r.initiativeTitle! } : null;
    i.cycle = r && r.cycleId != null ? { id: r.cycleId, name: r.cycleName! } : null;
  }
}

// Loads every issue's label ids and merges them onto the issues in place. Generic
// so it also enriches the lighter IssueSearchHit rows, which carry id + labelIds.
async function attachLabels<T extends { id: number; labelIds: number[] }>(
  issues: T[],
): Promise<void> {
  if (issues.length === 0) return;
  const rows = await db
    .select({ issueId: issueLabel.issueId, labelId: issueLabel.labelId })
    .from(issueLabel)
    .where(
      inArray(
        issueLabel.issueId,
        issues.map((i) => i.id),
      ),
    );
  const byIssue = new Map<number, number[]>();
  for (const r of rows) {
    let list = byIssue.get(r.issueId);
    if (!list) byIssue.set(r.issueId, (list = []));
    list.push(r.labelId);
  }
  for (const i of issues) i.labelIds = byIssue.get(i.id) ?? [];
}

// Loads every issue's custom field values in two queries (scalar values and
// selected option ids) and merges them onto the issues. A field with no scalar
// value and no options is omitted, so unset fields add nothing to the payload.
// Mutates the passed issues in place.
async function attachFieldValues(issues: IssueRow[]): Promise<void> {
  if (issues.length === 0) return;
  const issueIds = issues.map((i) => i.id);
  const [scalarRows, optionRows] = await Promise.all([
    db
      .select({
        issueId: issueFieldValue.issueId,
        fieldId: issueFieldValue.fieldId,
        valueText: issueFieldValue.valueText,
        valueNumber: issueFieldValue.valueNumber,
        valueBool: issueFieldValue.valueBool,
        valueDate: issueFieldValue.valueDate,
      })
      .from(issueFieldValue)
      .where(inArray(issueFieldValue.issueId, issueIds)),
    db
      .select({
        issueId: issueFieldOption.issueId,
        fieldId: issueFieldOption.fieldId,
        optionId: issueFieldOption.optionId,
      })
      .from(issueFieldOption)
      .where(inArray(issueFieldOption.issueId, issueIds)),
  ]);

  // issueId -> fieldId -> entry, built up from both queries then flushed onto
  // each issue. Keyed maps keep the merge O(rows) rather than O(issues*rows).
  const byIssue = new Map<number, Map<number, IssueFieldValueEntry>>();
  const entryFor = (issueId: number, fieldId: number): IssueFieldValueEntry => {
    let fields = byIssue.get(issueId);
    if (!fields) byIssue.set(issueId, (fields = new Map()));
    let entry = fields.get(fieldId);
    if (!entry) fields.set(fieldId, (entry = { fieldId, value: null, optionIds: [] }));
    return entry;
  };

  for (const row of scalarRows) entryFor(row.issueId, row.fieldId).value = pickScalarValue(row);
  for (const row of optionRows) entryFor(row.issueId, row.fieldId).optionIds.push(row.optionId);

  for (const i of issues) {
    const fields = byIssue.get(i.id);
    if (fields) i.fieldValues = [...fields.values()];
  }
}

// The snapshot columns of an issue, without the label and project-key joins a
// full load does. Used as the "before" state for the change-log diff, which
// needs only these columns, plus the project id the update's scope checks run
// against.
async function loadSnapshot(
  id: number,
): Promise<(IssueSnapshot & { projectId: number; parentId: number | null }) | null> {
  const rows = await db
    .select({
      id: issue.id,
      projectId: issue.projectId,
      parentId: issue.parentId,
      title: issue.title,
      description: issue.description,
      columnId: issue.columnId,
      typeId: issue.typeId,
      initiativeId: issue.initiativeId,
      cycleId: issue.cycleId,
      assigneeUserId: issue.assigneeUserId,
      delegateUserId: issue.delegateUserId,
      priority: issue.priority,
      startDate: issue.startDate,
      dueDate: issue.dueDate,
    })
    .from(issue)
    .where(eq(issue.id, id));
  return rows[0] ?? null;
}

export async function getIssue(id: number): Promise<IssueRow | null> {
  return (await getIssues([id]))[0] ?? null;
}

// Several issues at once, in no particular order. The per-issue enrichment is
// batched, so this costs what a single getIssue does however many ids it is given
// — which is what makes it worth using for the writes that touch two issues.
export async function getIssues(ids: number[]): Promise<IssueRow[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .select({ issue, projectKey: projectTable.key })
    .from(issue)
    .innerJoin(projectTable, eq(projectTable.id, issue.projectId))
    .where(inArray(issue.id, ids));
  const issues = rows.map((row) => mapIssue(row.issue, row.projectKey));
  await attachLabels(issues);
  await attachStatusSince(issues);
  await attachGroupings(issues);
  return issues;
}

// Loads an issue by its project-scoped sequence number (the human number in a URL
// like /project/MKT/issue/42). Returns null if the project has no issue with that
// number. Archived issues resolve too, so a link to one still opens.
export async function getIssueBySequence(
  projectId: number,
  sequenceNumber: number,
): Promise<IssueRow | null> {
  const rows = await db
    .select({ issue, projectKey: projectTable.key })
    .from(issue)
    .innerJoin(projectTable, eq(projectTable.id, issue.projectId))
    .where(and(eq(issue.projectId, projectId), eq(issue.sequenceNumber, sequenceNumber)));
  if (!rows[0]) return null;
  const mapped = mapIssue(rows[0].issue, rows[0].projectKey);
  await attachLabels([mapped]);
  await attachStatusSince([mapped]);
  await attachGroupings([mapped]);
  return mapped;
}

// The project an issue belongs to, or null if the issue does not exist. Used by
// the access check on routes that address an issue by its own id.
export async function getIssueProjectId(id: number): Promise<number | null> {
  const rows = await db.select({ projectId: issue.projectId }).from(issue).where(eq(issue.id, id));
  return rows[0]?.projectId ?? null;
}

export interface NewIssueInput {
  typeId?: number | null;
  initiativeId?: number | null;
  cycleId?: number | null;
  assigneeUserId?: string | null;
  delegateUserId?: string | null;
  columnId: number;
  parentId?: number | null;
  title: string;
  description?: string;
  priority?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  labelIds?: number[];
}

// Enforces that assignee holds a project member and delegate holds an agent of the
// same project. Only checks the fields present in the patch, and only when set to a
// non-null value (clearing a field is always allowed). Throws 400 otherwise.
async function assertAssignments(
  projectId: number,
  patch: { assigneeUserId?: string | null; delegateUserId?: string | null },
): Promise<void> {
  if (patch.assigneeUserId) {
    const role = await getMembership(projectId, patch.assigneeUserId);
    if (!role) throw new HttpError(400, 'Assignee must be a project member');
  }
  if (patch.delegateUserId) {
    if (!(await isProjectAgent(projectId, patch.delegateUserId)))
      throw new HttpError(400, 'Delegate must be an agent of this project');
  }
}

// Enforces that a linked initiative belongs to the same project. Only checks when
// set to a non-null value (clearing the link is always allowed). Throws 400
// otherwise.
async function assertInitiative(
  projectId: number,
  initiativeId: number | null | undefined,
): Promise<void> {
  if (initiativeId == null) return;
  if ((await getInitiativeProjectId(initiativeId)) !== projectId)
    throw new HttpError(400, 'Initiative must belong to this project');
}

// Enforces that a linked cycle belongs to the same project and has not finished: a
// completed cycle is the record of what it delivered, so no issue is planned into it
// after the fact. Only checks when the link changes to a non-null value — clearing
// it, and keeping the cycle an issue is already on, stay allowed. Throws 400
// otherwise.
async function assertCycle(
  projectId: number,
  cycleId: number | null | undefined,
  currentCycleId: number | null = null,
): Promise<void> {
  if (cycleId == null || cycleId === currentCycleId) return;
  const ref = await getCycleRef(cycleId);
  if (!ref || ref.projectId !== projectId)
    throw new HttpError(400, 'Cycle must belong to this project');
  if (ref.status === 'completed') throw new HttpError(400, 'A completed cycle takes no new issues');
}

// Enforces that a column belongs to the issue's project — issue.column_id only
// requires the column to exist somewhere, so an issue could otherwise sit on
// another project's board. Throws 400 otherwise.
async function assertColumn(projectId: number, columnId: number | undefined): Promise<void> {
  if (columnId === undefined) return;
  const rows = await db
    .select({ id: projectColumn.id })
    .from(projectColumn)
    .where(and(eq(projectColumn.id, columnId), eq(projectColumn.projectId, projectId)));
  if (rows.length === 0) throw new HttpError(400, 'Column must belong to this project');
}

// Enforces that an issue type belongs to the issue's project. Only checks when set
// to a non-null value (clearing the type is always allowed). Throws 400 otherwise.
async function assertIssueType(
  projectId: number,
  typeId: number | null | undefined,
): Promise<void> {
  if (typeId == null) return;
  const rows = await db
    .select({ id: issueType.id })
    .from(issueType)
    .where(and(eq(issueType.id, typeId), eq(issueType.projectId, projectId)));
  if (rows.length === 0) throw new HttpError(400, 'Issue type must belong to this project');
}

// Enforces the rules a parent link has to hold: both issues in the same project,
// no issue its own parent, and one level of nesting — the parent may not be a
// subtask itself, and an issue that already has subtasks may not become one.
// issueId is null when the issue is being created (it has no subtasks yet).
// Throws 400 otherwise; clearing the parent is always allowed.
async function assertParent(
  projectId: number,
  issueId: number | null,
  parentId: number | null | undefined,
): Promise<void> {
  if (parentId == null) return;
  if (parentId === issueId) throw new HttpError(400, 'An issue cannot be its own parent');
  const rows = await db
    .select({ projectId: issue.projectId, parentId: issue.parentId })
    .from(issue)
    .where(eq(issue.id, parentId));
  if (rows.length === 0 || rows[0].projectId !== projectId)
    throw new HttpError(400, 'Parent must belong to this project');
  if (rows[0].parentId !== null)
    throw new HttpError(400, 'A subtask cannot be the parent of another issue');
  if (issueId !== null && (await hasSubtasks(issueId)))
    throw new HttpError(400, 'An issue with subtasks cannot become a subtask');
}

// Whether the issue has subtasks, archived ones included: they stay attached to it
// and are restored as subtasks.
async function hasSubtasks(issueId: number): Promise<boolean> {
  const rows = await db
    .select({ id: issue.id })
    .from(issue)
    .where(eq(issue.parentId, issueId))
    .limit(1);
  return rows.length > 0;
}

// Enforces that every label belongs to the issue's project — the issue_label
// foreign key only requires the label to exist somewhere. Throws 400 otherwise.
async function assertIssueLabels(projectId: number, labelIds?: number[]): Promise<void> {
  const ids = [...new Set(labelIds ?? [])];
  if (ids.length === 0) return;
  const rows = await db
    .select({ id: label.id })
    .from(label)
    .where(and(eq(label.projectId, projectId), inArray(label.id, ids)));
  if (rows.length !== ids.length) throw new HttpError(400, 'Labels must belong to this project');
}

// Atomic per-project sequence number (the "-42" in "MKT-42"): the UPDATE takes a
// row lock on project, so concurrent createIssue calls for the same project never
// hand out the same number.
export async function createIssue(
  project: ProjectRow,
  input: NewIssueInput,
  actorUserId?: string | null,
): Promise<IssueRow> {
  await assertAssignments(project.id, input);
  await assertInitiative(project.id, input.initiativeId);
  await assertCycle(project.id, input.cycleId);
  await assertColumn(project.id, input.columnId);
  await assertIssueType(project.id, input.typeId);
  await assertParent(project.id, null, input.parentId);
  // Also checked by setIssueLabels below, but here it fails before the issue exists.
  await assertIssueLabels(project.id, input.labelIds);
  const issueId = await db.transaction(async (tx) => {
    const [seqRow] = await tx
      .update(projectTable)
      .set({ nextSequence: sql`next_sequence + 1` })
      .where(eq(projectTable.id, project.id))
      .returning({ seq: sql<number>`next_sequence - 1` });
    const sequenceNumber = Number(seqRow.seq);
    const [posRow] = await tx
      .select({ pos: sql<number>`COALESCE(MAX(${issue.position}), 0) + 1000` })
      .from(issue)
      .where(eq(issue.columnId, input.columnId));
    const [row] = await tx
      .insert(issue)
      .values({
        projectId: project.id,
        sequenceNumber,
        typeId: input.typeId ?? null,
        initiativeId: input.initiativeId ?? null,
        cycleId: input.cycleId ?? null,
        assigneeUserId: input.assigneeUserId ?? null,
        delegateUserId: input.delegateUserId ?? null,
        columnId: input.columnId,
        parentId: input.parentId ?? null,
        title: input.title,
        description: input.description ?? '',
        priority: input.priority ?? null,
        startDate: input.startDate ?? null,
        dueDate: input.dueDate ?? null,
        position: Number(posRow.pos),
      })
      .returning({ id: issue.id });
    return row.id;
  });

  await recordActivity(issueId, [{ action: 'created' }], actorUserId);
  if (input.parentId != null) await recordParentChange(issueId, null, input.parentId, actorUserId);
  // Suppress the label_changed event on creation — the initial labels are part of
  // the issue.created payload, so a separate change event would be redundant.
  if (input.labelIds?.length)
    await setIssueLabels(project.id, issueId, input.labelIds, actorUserId, false);
  const created = (await getIssue(issueId))!;
  // The author follows what they filed; the assignee is subscribed by the
  // assignment notification below, the same as a later assignment does.
  await autoWatchIssue(project.id, issueId, [actorUserId]);
  await emitWebhookEvent(project.id, 'issue.created', created);
  // An issue created already delegated to an agent enqueues a run, the same as
  // delegating one later does.
  await enqueueDelegateRun(created, actorUserId);
  // An issue created already assigned to a member notifies them, the same as
  // assigning one later does.
  if (created.assigneeUserId) {
    await notifyIssueChange({
      projectId: project.id,
      issueId,
      actorUserId: actorUserId ?? null,
      assignedUserId: created.assigneeUserId,
    });
  }
  return created;
}

// The identifiers ("MKT-42") of the given issues, for the activity entries a parent
// change writes. An id with no issue is absent from the map.
async function identifiers(ids: number[]): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  if (ids.length === 0) return out;
  const rows = await db
    .select({ id: issue.id, key: projectTable.key, seq: issue.sequenceNumber })
    .from(issue)
    .innerJoin(projectTable, eq(projectTable.id, issue.projectId))
    .where(inArray(issue.id, ids));
  for (const row of rows) out.set(row.id, `${row.key}-${row.seq}`);
  return out;
}

// Writes a parent change to the feeds of every issue it concerns: the subtask reads
// which parent it moved between, each parent reads the subtask it gained or lost.
async function recordParentChange(
  childId: number,
  before: number | null,
  after: number | null,
  actorUserId?: string | null,
): Promise<void> {
  const names = await identifiers(
    [childId, before, after].filter((id): id is number => id !== null),
  );
  const child = names.get(childId) ?? null;
  const entries: { issueId: number; event: ActivityInput }[] = [
    {
      issueId: childId,
      event: {
        action: 'parent',
        fromText: before === null ? null : (names.get(before) ?? null),
        toText: after === null ? null : (names.get(after) ?? null),
      },
    },
  ];
  if (before !== null)
    entries.push({ issueId: before, event: { action: 'subtask_remove', fromText: child } });
  if (after !== null)
    entries.push({ issueId: after, event: { action: 'subtask_add', toText: child } });
  await recordActivityEntries(entries, actorUserId);
}

export interface IssuePatch {
  columnId?: number;
  position?: number;
  typeId?: number | null;
  parentId?: number | null;
  initiativeId?: number | null;
  cycleId?: number | null;
  assigneeUserId?: string | null;
  delegateUserId?: string | null;
  title?: string;
  description?: string;
  priority?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
}

export async function updateIssue(
  id: number,
  patch: IssuePatch,
  actorUserId?: string | null,
): Promise<IssueRow | null> {
  const before = await loadSnapshot(id);
  if (!before) return null;

  await assertAssignments(before.projectId, patch);
  await assertInitiative(before.projectId, patch.initiativeId);
  await assertCycle(before.projectId, patch.cycleId, before.cycleId);
  await assertColumn(before.projectId, patch.columnId);
  await assertIssueType(before.projectId, patch.typeId);
  await assertParent(before.projectId, id, patch.parentId);

  const set: Partial<typeof issue.$inferInsert> = {};
  if (patch.columnId !== undefined) set.columnId = patch.columnId;
  if (patch.position !== undefined) set.position = patch.position;
  if (patch.typeId !== undefined) set.typeId = patch.typeId;
  if (patch.parentId !== undefined) set.parentId = patch.parentId;
  if (patch.initiativeId !== undefined) set.initiativeId = patch.initiativeId;
  if (patch.cycleId !== undefined) set.cycleId = patch.cycleId;
  if (patch.assigneeUserId !== undefined) set.assigneeUserId = patch.assigneeUserId;
  if (patch.delegateUserId !== undefined) set.delegateUserId = patch.delegateUserId;
  if (patch.title !== undefined) set.title = patch.title;
  if (patch.description !== undefined) set.description = patch.description;
  if (patch.priority !== undefined) set.priority = patch.priority;
  if (patch.startDate !== undefined) set.startDate = patch.startDate;
  if (patch.dueDate !== undefined) set.dueDate = patch.dueDate;

  const changed = Object.keys(set).length > 0;
  if (changed) {
    set.updatedAt = sql`now()` as unknown as Date;
    await db.update(issue).set(set).where(eq(issue.id, id));
  }
  const after = await getIssue(id);
  if (after) {
    await logIssueUpdate(before, snapshot(after), actorUserId);
    if (before.parentId !== after.parentId)
      await recordParentChange(id, before.parentId, after.parentId, actorUserId);
    if (changed) {
      await emitWebhookEvent(after.projectId, 'issue.updated', after);
      // Granular events fire in addition to issue.updated when their field changed.
      if (before.assigneeUserId !== after.assigneeUserId)
        await emitWebhookEvent(after.projectId, 'issue.assigned', after);
      if (before.delegateUserId !== after.delegateUserId)
        await enqueueDelegateRun(after, actorUserId);
      if (before.columnId !== after.columnId)
        await emitWebhookEvent(after.projectId, 'issue.state_changed', after);
    }
  }
  return after;
}

// If an issue's new delegate is an internal agent that reacts to delegation, queue a
// run so it can act on the issue. Skipped when the agent delegated to itself (an
// agent setting itself off). The LLM call happens later in the poller, so the write
// is never blocked on it.
async function enqueueDelegateRun(after: IssueRow, actorUserId?: string | null): Promise<void> {
  const delegate = after.delegateUserId;
  if (!delegate || delegate === actorUserId) return;
  const agent = await getAssignTriggerAgent(delegate);
  if (!agent) return;
  await enqueueAgentRun({
    agentId: agent.id,
    issueId: after.id,
    sourceActivityId: null,
    prompt: `Work item ${after.identifier}: "${after.title}" has been delegated to you. Review it and take the appropriate next step.`,
  });
}

// Deletes an issue and everything attached to it. Field options/values, labels,
// attachments, and activity all go by their ON DELETE CASCADE on issue_id. Returns
// the deleted attachment rows so the caller can remove their objects from the store.
// Returns null if the issue did not exist.
export async function deleteIssue(issueId: number): Promise<AttachmentRow[] | null> {
  const result = await db.transaction(async (tx) => {
    const rows = await tx
      .select({ projectId: issue.projectId, seq: issue.sequenceNumber, key: projectTable.key })
      .from(issue)
      .innerJoin(projectTable, eq(projectTable.id, issue.projectId))
      .where(eq(issue.id, issueId));
    if (rows.length === 0) return null;
    const attachmentRows = await tx
      .select()
      .from(issueAttachment)
      .where(eq(issueAttachment.issueId, issueId));
    await tx.delete(issue).where(eq(issue.id, issueId));
    return {
      attachments: attachmentRows.map(mapAttachment),
      projectId: rows[0].projectId,
      identifier: `${rows[0].key}-${rows[0].seq}`,
    };
  });
  if (!result) return null;
  await emitWebhookEvent(result.projectId, 'issue.deleted', {
    id: issueId,
    identifier: result.identifier,
  });
  return result.attachments;
}

// Replaces the issue's full label set (not an add/remove diff) and logs the
// added/removed labels to the activity feed. projectId is the issue's project: a
// label outside it is rejected before anything is written.
export async function setIssueLabels(
  projectId: number,
  issueId: number,
  labelIds: number[],
  actorUserId?: string | null,
  emitEvent = true,
): Promise<void> {
  await assertIssueLabels(projectId, labelIds);
  const beforeRows = await db
    .select({ labelId: issueLabel.labelId })
    .from(issueLabel)
    .where(eq(issueLabel.issueId, issueId));
  const before = beforeRows.map((r) => r.labelId);
  const next = [...new Set(labelIds)];

  await db.delete(issueLabel).where(eq(issueLabel.issueId, issueId));
  if (next.length) {
    await db
      .insert(issueLabel)
      .values(next.map((labelId) => ({ issueId, labelId })))
      .onConflictDoNothing();
  }

  const added = next.filter((x) => !before.includes(x));
  const removed = before.filter((x) => !next.includes(x));

  // Labels show on the board card, so a label change must bump the issue's
  // updated_at: the board's change marker (projectBoardRev) is derived from it.
  if (added.length > 0 || removed.length > 0) {
    await db
      .update(issue)
      .set({ updatedAt: sql`now()` })
      .where(eq(issue.id, issueId));
  }

  const names = await labelNames(projectId, [...added, ...removed]);
  const events: ActivityInput[] = [];
  for (const labelId of added)
    events.push({ action: 'label_add', toText: names.get(labelId) ?? null });
  for (const labelId of removed)
    events.push({ action: 'label_remove', fromText: names.get(labelId) ?? null });
  await recordActivity(issueId, events, actorUserId);

  if (emitEvent && (added.length > 0 || removed.length > 0)) {
    const issueRow = await getIssue(issueId);
    if (issueRow) await emitWebhookEvent(issueRow.projectId, 'issue.label_changed', issueRow);
  }
}

// --- Bulk actions ----------------------------------------------------------------
// Board multi-select applies one change to many issues at once. Each of these runs
// the single-issue operation per id in the request, so the per-issue side effects
// (activity feed, webhooks, delegate runs) still fire, but the client makes one
// request and refetches the board once instead of N times.

// The subset of `ids` that belong to this project (active or archived). The bulk
// routes are project-scoped by their guard; filtering here drops any id the client
// sent that is not in this project, so a bulk action can never reach across projects.
async function issuesInProject(projectId: number, ids: number[]): Promise<number[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .select({ id: issue.id })
    .from(issue)
    .where(and(eq(issue.projectId, projectId), inArray(issue.id, ids)));
  return rows.map((r) => r.id);
}

// Moves a cycle's unfinished issues — the ones outside a completed or canceled
// column — to another cycle, or off any cycle when targetCycleId is null. What the
// cycle finished stays on it, so it keeps recording what it delivered. Runs the
// single-issue update per issue, so each move lands in the feed like a hand-made
// one. Returns how many issues moved.
export async function transferCycleIssues(
  projectId: number,
  cycleId: number,
  targetCycleId: number | null,
  actorUserId?: string | null,
): Promise<number> {
  if (targetCycleId === cycleId) throw new HttpError(400, 'Target cycle must be a different cycle');
  await assertCycle(projectId, targetCycleId);

  const rows = await db
    .select({ id: issue.id })
    .from(issue)
    .innerJoin(projectColumn, eq(projectColumn.id, issue.columnId))
    .where(
      and(
        eq(issue.cycleId, cycleId),
        isNull(issue.archivedAt),
        notInArray(projectColumn.stateType, ['completed', 'canceled']),
      ),
    );
  for (const row of rows) await updateIssue(row.id, { cycleId: targetCycleId }, actorUserId);
  return rows.length;
}

// Applies the same patch to every listed issue. Returns how many were updated.
export async function bulkUpdateIssues(
  projectId: number,
  ids: number[],
  patch: IssuePatch,
  actorUserId?: string | null,
): Promise<number> {
  const valid = await issuesInProject(projectId, ids);
  for (const id of valid) await updateIssue(id, patch, actorUserId);
  return valid.length;
}

// Adds the given labels to every listed issue, keeping each issue's existing
// labels. An issue that already carries all of them is left untouched. Returns how
// many issues changed.
export async function bulkAddLabels(
  projectId: number,
  ids: number[],
  labelIds: number[],
  actorUserId?: string | null,
): Promise<number> {
  const add = [...new Set(labelIds)];
  await assertIssueLabels(projectId, add);
  const valid = await issuesInProject(projectId, ids);
  if (add.length === 0 || valid.length === 0) return 0;

  const rows = await db
    .select({ issueId: issueLabel.issueId, labelId: issueLabel.labelId })
    .from(issueLabel)
    .where(inArray(issueLabel.issueId, valid));
  const current = new Map<number, number[]>();
  for (const r of rows) {
    let list = current.get(r.issueId);
    if (!list) current.set(r.issueId, (list = []));
    list.push(r.labelId);
  }

  let changed = 0;
  for (const id of valid) {
    const have = current.get(id) ?? [];
    const missing = add.filter((l) => !have.includes(l));
    if (missing.length === 0) continue;
    await setIssueLabels(projectId, id, [...have, ...missing], actorUserId);
    changed++;
  }
  return changed;
}

// Archives every listed issue. Returns how many were archived (already-archived
// issues re-stamp to a no-op and still count).
export async function bulkArchiveIssues(
  projectId: number,
  ids: number[],
  actorUserId?: string | null,
): Promise<number> {
  const valid = await issuesInProject(projectId, ids);
  for (const id of valid) await archiveIssue(id, actorUserId);
  return valid.length;
}

// Deletes every listed issue. Returns the count deleted and their attachment rows
// so the caller can remove the objects from the store.
export async function bulkDeleteIssues(
  projectId: number,
  ids: number[],
): Promise<{ deleted: number; attachments: AttachmentRow[] }> {
  const valid = await issuesInProject(projectId, ids);
  const attachments: AttachmentRow[] = [];
  for (const id of valid) {
    const rows = await deleteIssue(id);
    if (rows) attachments.push(...rows);
  }
  return { deleted: valid.length, attachments };
}

// --- Change markers (cheap watermarks for live refresh) --------------------------
// Opaque strings that change whenever the corresponding view's data changes.
// Clients poll these cheaply and refetch the heavy payload only when the marker
// moved, so a live board / open issue stays current without constant full reads.

// The board's marker: changes when any issue, initiative or cycle in the project
// is created, updated, or deleted. Issue label changes bump updated_at too (see
// setIssueLabels). Initiative and cycle metadata is part of the work-items board
// payload — each issue carries the name of the one it belongs to, so a rename has
// to move the marker. Links are part of it as well and change no issue's
// updated_at, so they carry their own count and highest id: adding one raises the
// id, removing one lowers the count.
export async function projectBoardRev(projectId: number): Promise<string> {
  const [row] = await db
    .select({
      n: sql<number>`count(*)`,
      m: sql<string | null>`max(${issue.updatedAt})::text`,
      initiativeCount: sql<number>`(select count(*) from ${initiative} where ${initiative.projectId} = ${projectId})`,
      initiativeMax: sql<
        string | null
      >`(select max(${initiative.updatedAt})::text from ${initiative} where ${initiative.projectId} = ${projectId})`,
      cycleCount: sql<number>`(select count(*) from ${cycle} where ${cycle.projectId} = ${projectId})`,
      cycleMax: sql<
        string | null
      >`(select max(${cycle.updatedAt})::text from ${cycle} where ${cycle.projectId} = ${projectId})`,
    })
    // Only active issues count: archiving one (manual or the worker's sweep) drops
    // the count, which moves the marker and makes the board refetch it away.
    .from(issue)
    .where(and(eq(issue.projectId, projectId), isNull(issue.archivedAt)));

  // Separate from the issue aggregate: joining the links onto it would multiply
  // the issue rows, and a subquery over both tables cannot tell the two `id`
  // columns apart (Drizzle writes an unqualified column into a raw fragment).
  const [links] = await db
    .select({ count: sql<number>`count(*)`, max: sql<number | null>`max(${issueLink.id})` })
    .from(issueLink)
    .where(
      inArray(
        issueLink.sourceIssueId,
        db.select({ id: issue.id }).from(issue).where(eq(issue.projectId, projectId)),
      ),
    );

  return [
    row?.n ?? 0,
    row?.m ?? '',
    row?.initiativeCount ?? 0,
    row?.initiativeMax ?? '',
    row?.cycleCount ?? 0,
    row?.cycleMax ?? '',
    links?.count ?? 0,
    links?.max ?? '',
  ].join(':');
}

// One issue's marker: changes on any edit or new timeline entry (comment or
// activity), including an agent's reply. max(activity.id) covers the feed and every
// logged edit; updated_at covers in-place field edits.
export async function issueRev(issueId: number): Promise<string> {
  const [row] = await db
    .select({
      a: sql<number | null>`(select max(id) from issue_activity where issue_id = ${issueId})`,
      u: sql<string>`${issue.updatedAt}::text`,
    })
    .from(issue)
    .where(eq(issue.id, issueId));
  return row ? `${row.a ?? 0}:${row.u}` : '0:';
}

// --- Custom field values on an issue ---------------------------------------------

export interface IssueFieldValueRow {
  fieldId: number;
  name: string;
  fieldType: CustomFieldType;
  value: string | number | boolean | null;
  optionIds: number[];
}

function pickScalarValue(row: {
  valueText: string | null;
  valueNumber: string | null;
  valueBool: boolean | null;
  valueDate: string | null;
}): string | number | boolean | null {
  if (row.valueText != null) return row.valueText;
  if (row.valueNumber != null) return Number(row.valueNumber);
  if (row.valueBool != null) return row.valueBool;
  if (row.valueDate != null) return row.valueDate;
  return null;
}

// The fields of the issue's project that apply to it (the project-wide ones plus
// its type's own), each joined with whatever value has been set for it (null if
// unset).
export async function getIssueFieldValues(issueId: number): Promise<IssueFieldValueRow[]> {
  const rows = await db
    .select({
      fieldId: customField.id,
      name: customField.name,
      fieldType: customField.fieldType,
      valueText: issueFieldValue.valueText,
      valueNumber: issueFieldValue.valueNumber,
      valueBool: issueFieldValue.valueBool,
      valueDate: issueFieldValue.valueDate,
    })
    .from(issue)
    .innerJoin(
      customField,
      and(
        eq(customField.projectId, issue.projectId),
        or(isNull(customField.issueTypeId), eq(customField.issueTypeId, issue.typeId)),
      ),
    )
    .leftJoin(
      issueFieldValue,
      and(eq(issueFieldValue.fieldId, customField.id), eq(issueFieldValue.issueId, issue.id)),
    )
    .where(eq(issue.id, issueId))
    .orderBy(customField.position);

  const optionRows = await db
    .select({ fieldId: issueFieldOption.fieldId, optionId: issueFieldOption.optionId })
    .from(issueFieldOption)
    .where(eq(issueFieldOption.issueId, issueId));
  const optionsByField = new Map<number, number[]>();
  for (const r of optionRows) {
    let list = optionsByField.get(r.fieldId);
    if (!list) optionsByField.set(r.fieldId, (list = []));
    list.push(r.optionId);
  }

  return rows.map((row) => ({
    fieldId: row.fieldId,
    name: row.name,
    fieldType: row.fieldType as CustomFieldType,
    value: pickScalarValue(row),
    optionIds: optionsByField.get(row.fieldId) ?? [],
  }));
}

// A value is an acceptable url field value when it parses as an absolute
// http(s) URL. Other schemes (mailto:, javascript:, file:) are rejected.
function isHttpUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return url.protocol === 'http:' || url.protocol === 'https:';
}

// Sets one field's value on one issue. projectId is the issue's project: the field
// is resolved inside it, so a field id belonging to another project does not match.
// For select/multi_select fields, pass optionIds (replaces the full selection); for
// every other field type, pass value matching the field's type.
export async function setIssueFieldValue(
  projectId: number,
  issueId: number,
  fieldId: number,
  input: { value?: string | number | boolean | null; optionIds?: number[] },
  actorUserId?: string | null,
): Promise<void> {
  const field = await getCustomFieldById(projectId, fieldId);
  if (!field) throw new HttpError(404, 'Custom field not found');

  // A url field stores its value as text but must hold a valid http(s) URL.
  if (field.fieldType === 'url' && typeof input.value === 'string' && input.value !== '') {
    if (!isHttpUrl(input.value)) throw new HttpError(400, 'Invalid URL');
  }
  // A number field must be a finite number; the value column is numeric.
  if (field.fieldType === 'number' && input.value != null && input.value !== '') {
    if (!Number.isFinite(Number(input.value))) throw new HttpError(400, 'Invalid number');
  }

  // to_text is the display-ready new value logged to the activity feed: option
  // value names for select/multi_select, the raw value for everything else.
  let toText: string | null;

  if (field.fieldType === 'select' || field.fieldType === 'multi_select') {
    const optionIds = input.optionIds ?? [];
    // An option must be one of this field's own: the issue_field_option foreign key
    // only requires it to exist somewhere. Resolved before the delete so a rejected
    // request leaves the current selection untouched.
    const names = optionIds.map((optionId) => {
      const option = field.options.find((o) => o.id === optionId);
      if (!option) throw new HttpError(400, 'Option does not belong to this field');
      return option.value;
    });

    await db
      .delete(issueFieldOption)
      .where(and(eq(issueFieldOption.issueId, issueId), eq(issueFieldOption.fieldId, fieldId)));
    if (optionIds.length) {
      await db
        .insert(issueFieldOption)
        .values(optionIds.map((optionId) => ({ issueId, fieldId, optionId })));
    }
    toText = names.length ? names.join(', ') : null;
  } else {
    // The value column matching the field's type; the others stay NULL. Both the
    // insert and the on-conflict update write only that one column.
    let column: Partial<typeof issueFieldValue.$inferInsert>;
    switch (field.fieldType) {
      case 'number':
        column = { valueNumber: input.value == null ? null : String(input.value) };
        break;
      case 'boolean':
        column = { valueBool: input.value == null ? null : Boolean(input.value) };
        break;
      case 'date':
        column = { valueDate: (input.value as string) ?? null };
        break;
      default:
        column = { valueText: (input.value as string) ?? null };
    }
    await db
      .insert(issueFieldValue)
      .values({ issueId, fieldId, ...column })
      .onConflictDoUpdate({
        target: [issueFieldValue.issueId, issueFieldValue.fieldId],
        set: column,
      });
    const value = input.value;
    if (value == null || value === '') {
      toText = null;
    } else if (field.fieldType === 'boolean') {
      toText = value ? 'true' : 'false';
    } else {
      toText = String(value);
    }
  }

  await recordActivity(issueId, [{ action: 'field', subject: field.name, toText }], actorUserId);
}
