import {
  db,
  intakeAttachment,
  intakeComment,
  intakeRequest,
  issue,
  issueActivity,
  issueAttachment,
  projectColumn,
  user,
} from '@repo/db';
import { and, asc, desc, eq, gt, ilike, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { HttpError, iso, num, rethrowDuplicate } from '#shared/lib';
import { getProjectById } from '#modules/projects/service';
import { createIssue, type IssueRow } from '#modules/issues/service';
import { notifyIntakeOutcome } from '#modules/notifications/service';
import { emitWebhookEvents } from '#modules/webhooks/emit';
import {
  assertAttachmentStorageCapacity,
  deleteAttachmentObject,
  lockAttachmentStorage,
} from '#modules/attachments/storage';
import type { IntakeStatus } from './model';

export interface LinkedIssueSummary {
  id: number;
  sequenceNumber: number;
  title: string;
}

export interface IntakeAttachmentDto {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
  url: string;
}

export interface IntakeCommentDto {
  id: number;
  intakeRequestId: number;
  actorUserId: string | null;
  actorName: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface IntakeRequestDto {
  id: number;
  projectId: number;
  title: string;
  description: string;
  priority: 'urgent' | 'high' | 'medium' | 'low' | null;
  status: IntakeStatus;
  source: string;
  externalId: string | null;
  submittedByUserId: string | null;
  submittedByName: string | null;
  reviewedByUserId: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  declineReason: string | null;
  snoozedUntil: string | null;
  acceptedIssueId: number | null;
  acceptedIssue: LinkedIssueSummary | null;
  duplicateOfIssueId: number | null;
  duplicateOfIssue: LinkedIssueSummary | null;
  commentCount: number;
  attachmentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface IntakeRequestDetailDto extends IntakeRequestDto {
  comments: IntakeCommentDto[];
  attachments: IntakeAttachmentDto[];
}

export interface IntakeSummaryDto {
  pendingCount: number;
  snoozedCount: number;
  acceptedCount: number;
  declinedCount: number;
  duplicateCount: number;
  oldestPendingAt: string | null;
  oldestPendingAgeMs: number | null;
}

export interface IntakeAttachmentRow {
  id: number;
  publicId: string;
  intakeRequestId: number;
  s3Key: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
}

function mapAttachmentDto(row: typeof intakeAttachment.$inferSelect): IntakeAttachmentDto {
  return {
    id: row.publicId,
    filename: row.filename,
    contentType: row.contentType,
    sizeBytes: num(row.sizeBytes),
    createdAt: iso(row.createdAt),
    url: `/intake-attachments/${row.publicId}/raw`,
  };
}

function mapAttachmentRow(row: typeof intakeAttachment.$inferSelect): IntakeAttachmentRow {
  return {
    id: row.id,
    publicId: row.publicId,
    intakeRequestId: row.intakeRequestId,
    s3Key: row.s3Key,
    filename: row.filename,
    contentType: row.contentType,
    sizeBytes: num(row.sizeBytes),
    createdAt: iso(row.createdAt),
  };
}

function mapComment(row: typeof intakeComment.$inferSelect): IntakeCommentDto {
  return {
    id: row.id,
    intakeRequestId: row.intakeRequestId,
    actorUserId: row.actorUserId,
    actorName: row.actorName,
    body: row.body,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

// Effective status: a snoozed request whose snoozedUntil has passed surfaces as pending.
function effectiveStatus(row: typeof intakeRequest.$inferSelect, now = new Date()): IntakeStatus {
  if (row.status === 'snoozed' && row.snoozedUntil && row.snoozedUntil <= now) {
    return 'pending';
  }
  return row.status as IntakeStatus;
}

async function resolveUserName(userId: string | null | undefined): Promise<string | null> {
  if (!userId) return null;
  const [row] = await db.select({ name: user.name }).from(user).where(eq(user.id, userId));
  return row?.name ?? null;
}

async function hydrateRequests(
  rows: (typeof intakeRequest.$inferSelect)[],
): Promise<IntakeRequestDto[]> {
  if (rows.length === 0) return [];
  const requestIds = rows.map((r) => r.id);
  const linkedIssueIds = [
    ...new Set(
      rows
        .flatMap((r) => [r.acceptedIssueId, r.duplicateOfIssueId])
        .filter((id): id is number => id != null),
    ),
  ];

  const [issues, commentCounts, attachmentCounts] = await Promise.all([
    linkedIssueIds.length > 0
      ? db
          .select({ id: issue.id, sequenceNumber: issue.sequenceNumber, title: issue.title })
          .from(issue)
          .where(inArray(issue.id, linkedIssueIds))
      : Promise.resolve([]),
    db
      .select({
        intakeRequestId: intakeComment.intakeRequestId,
        count: sql<number>`count(*)::int`,
      })
      .from(intakeComment)
      .where(inArray(intakeComment.intakeRequestId, requestIds))
      .groupBy(intakeComment.intakeRequestId),
    db
      .select({
        intakeRequestId: intakeAttachment.intakeRequestId,
        count: sql<number>`count(*)::int`,
      })
      .from(intakeAttachment)
      .where(inArray(intakeAttachment.intakeRequestId, requestIds))
      .groupBy(intakeAttachment.intakeRequestId),
  ]);

  const issueById = new Map(issues.map((i) => [i.id, i]));
  const commentsByReq = new Map(commentCounts.map((c) => [c.intakeRequestId, c.count]));
  const attachmentsByReq = new Map(attachmentCounts.map((a) => [a.intakeRequestId, a.count]));
  const now = new Date();

  return rows.map((row) => ({
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    description: row.description,
    priority: (row.priority as IntakeRequestDto['priority']) ?? null,
    status: effectiveStatus(row, now),
    source: row.source,
    externalId: row.externalId,
    submittedByUserId: row.submittedByUserId,
    submittedByName: row.submittedByName,
    reviewedByUserId: row.reviewedByUserId,
    reviewedByName: row.reviewedByName,
    reviewedAt: row.reviewedAt ? iso(row.reviewedAt) : null,
    declineReason: row.declineReason,
    snoozedUntil: row.snoozedUntil ? iso(row.snoozedUntil) : null,
    acceptedIssueId: row.acceptedIssueId,
    acceptedIssue: row.acceptedIssueId ? (issueById.get(row.acceptedIssueId) ?? null) : null,
    duplicateOfIssueId: row.duplicateOfIssueId,
    duplicateOfIssue: row.duplicateOfIssueId
      ? (issueById.get(row.duplicateOfIssueId) ?? null)
      : null,
    commentCount: commentsByReq.get(row.id) ?? 0,
    attachmentCount: attachmentsByReq.get(row.id) ?? 0,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  }));
}

export async function getIntakeRequestProjectId(requestId: number): Promise<number | null> {
  const [row] = await db
    .select({ projectId: intakeRequest.projectId })
    .from(intakeRequest)
    .where(eq(intakeRequest.id, requestId));
  return row?.projectId ?? null;
}

export async function getIntakeCommentProjectId(commentId: number): Promise<number | null> {
  const [row] = await db
    .select({ projectId: intakeRequest.projectId })
    .from(intakeComment)
    .innerJoin(intakeRequest, eq(intakeRequest.id, intakeComment.intakeRequestId))
    .where(eq(intakeComment.id, commentId));
  return row?.projectId ?? null;
}

export async function getIntakeAttachmentProjectId(publicId: string): Promise<number | null> {
  const [row] = await db
    .select({ projectId: intakeRequest.projectId })
    .from(intakeAttachment)
    .innerJoin(intakeRequest, eq(intakeRequest.id, intakeAttachment.intakeRequestId))
    .where(eq(intakeAttachment.publicId, publicId));
  return row?.projectId ?? null;
}

export async function getIntakeAttachmentByPublicId(
  publicId: string,
): Promise<IntakeAttachmentRow | null> {
  const [row] = await db
    .select()
    .from(intakeAttachment)
    .where(eq(intakeAttachment.publicId, publicId));
  return row ? mapAttachmentRow(row) : null;
}

function statusFilterCondition(status: IntakeStatus | 'all') {
  if (status === 'all') return undefined;
  if (status === 'pending') {
    return or(
      eq(intakeRequest.status, 'pending'),
      and(eq(intakeRequest.status, 'snoozed'), lte(intakeRequest.snoozedUntil, sql`now()`)),
    );
  }
  if (status === 'snoozed') {
    return and(
      eq(intakeRequest.status, 'snoozed'),
      or(isNull(intakeRequest.snoozedUntil), gt(intakeRequest.snoozedUntil, sql`now()`)),
    );
  }
  return eq(intakeRequest.status, status);
}

export async function listIntakeRequests(
  projectId: number,
  filters: {
    status?: IntakeStatus | 'all';
    source?: string;
    externalId?: string;
    q?: string;
  },
  slice: { limit: number; offset: number },
): Promise<{ items: IntakeRequestDto[]; total: number }> {
  const status = filters.status ?? 'pending';
  const conds = [eq(intakeRequest.projectId, projectId)];
  const statusCond = statusFilterCondition(status);
  if (statusCond) conds.push(statusCond);
  if (filters.source) conds.push(eq(intakeRequest.source, filters.source));
  if (filters.externalId) conds.push(eq(intakeRequest.externalId, filters.externalId));
  if (filters.q?.trim()) {
    const pattern = `%${filters.q.trim()}%`;
    conds.push(or(ilike(intakeRequest.title, pattern), ilike(intakeRequest.description, pattern))!);
  }

  const where = and(...conds);
  // Waiting requests show oldest first so stale requests do not get buried.
  const order =
    status === 'pending'
      ? [asc(intakeRequest.createdAt), asc(intakeRequest.id)]
      : [desc(intakeRequest.createdAt), desc(intakeRequest.id)];

  const [[countRow], rows] = await Promise.all([
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(intakeRequest)
      .where(where),
    db
      .select()
      .from(intakeRequest)
      .where(where)
      .orderBy(...order)
      .limit(slice.limit)
      .offset(slice.offset),
  ]);

  return {
    items: await hydrateRequests(rows),
    total: countRow?.total ?? 0,
  };
}

export async function getIntakeSummary(projectId: number): Promise<IntakeSummaryDto> {
  const [counts] = await db
    .select({
      pendingCount: sql<number>`count(*) filter (where ${intakeRequest.status} = 'pending' or (${intakeRequest.status} = 'snoozed' and ${intakeRequest.snoozedUntil} <= now()))::int`,
      snoozedCount: sql<number>`count(*) filter (where ${intakeRequest.status} = 'snoozed' and (${intakeRequest.snoozedUntil} is null or ${intakeRequest.snoozedUntil} > now()))::int`,
      acceptedCount: sql<number>`count(*) filter (where ${intakeRequest.status} = 'accepted')::int`,
      declinedCount: sql<number>`count(*) filter (where ${intakeRequest.status} = 'declined')::int`,
      duplicateCount: sql<number>`count(*) filter (where ${intakeRequest.status} = 'duplicate')::int`,
      oldestPendingAt: sql<Date | null>`min(${intakeRequest.createdAt}) filter (where ${intakeRequest.status} = 'pending' or (${intakeRequest.status} = 'snoozed' and ${intakeRequest.snoozedUntil} <= now()))`,
    })
    .from(intakeRequest)
    .where(eq(intakeRequest.projectId, projectId));

  const oldest = counts?.oldestPendingAt ? new Date(counts.oldestPendingAt) : null;
  const oldestPendingAgeMs = oldest ? Math.max(0, Date.now() - oldest.getTime()) : null;

  return {
    pendingCount: counts?.pendingCount ?? 0,
    snoozedCount: counts?.snoozedCount ?? 0,
    acceptedCount: counts?.acceptedCount ?? 0,
    declinedCount: counts?.declinedCount ?? 0,
    duplicateCount: counts?.duplicateCount ?? 0,
    oldestPendingAt: oldest ? iso(oldest) : null,
    oldestPendingAgeMs,
  };
}

export async function getIntakeRequest(requestId: number): Promise<IntakeRequestDto | null> {
  const [row] = await db.select().from(intakeRequest).where(eq(intakeRequest.id, requestId));
  if (!row) return null;
  const [dto] = await hydrateRequests([row]);
  return dto ?? null;
}

export async function getIntakeRequestDetail(
  requestId: number,
): Promise<IntakeRequestDetailDto | null> {
  const dto = await getIntakeRequest(requestId);
  if (!dto) return null;
  const [comments, attachments] = await Promise.all([
    listIntakeComments(requestId),
    listIntakeAttachments(requestId),
  ]);
  return { ...dto, comments, attachments };
}

export async function createIntakeRequest(
  projectId: number,
  input: {
    title: string;
    description?: string;
    priority?: 'urgent' | 'high' | 'medium' | 'low' | null;
    source?: string;
    externalId?: string | null;
    submittedByName?: string | null;
  },
  actorUserId: string | null,
): Promise<IntakeRequestDto> {
  const title = input.title.trim();
  if (!title) throw new HttpError(400, 'Title cannot be empty');
  const source = (input.source?.trim() || 'app').slice(0, 64);
  const externalId = input.externalId?.trim() || null;
  const submittedByName = input.submittedByName?.trim() || (await resolveUserName(actorUserId));

  const [row] = await db
    .insert(intakeRequest)
    .values({
      projectId,
      title,
      description: input.description ?? '',
      priority: input.priority ?? null,
      status: 'pending',
      source,
      externalId,
      submittedByUserId: actorUserId,
      submittedByName,
    })
    .returning()
    .catch((err) =>
      rethrowDuplicate(err, 'An intake request with this source and external id already exists'),
    );

  const [dto] = await hydrateRequests([row]);
  await emitWebhookEvents(projectId, 'intake.created', async () => [dto], actorUserId);
  return dto;
}

export async function updateIntakeRequest(
  requestId: number,
  patch: {
    title?: string;
    description?: string;
    priority?: 'urgent' | 'high' | 'medium' | 'low' | null;
  },
): Promise<IntakeRequestDto | null> {
  const set: Partial<typeof intakeRequest.$inferInsert> = { updatedAt: new Date() };
  if (patch.title !== undefined) {
    const trimmed = patch.title.trim();
    if (!trimmed) throw new HttpError(400, 'Title cannot be empty');
    set.title = trimmed;
  }
  if (patch.description !== undefined) set.description = patch.description;
  if (patch.priority !== undefined) set.priority = patch.priority;

  const [row] = await db
    .update(intakeRequest)
    .set(set)
    .where(eq(intakeRequest.id, requestId))
    .returning();
  if (!row) return null;
  const [dto] = await hydrateRequests([row]);
  return dto ?? null;
}

export async function deleteIntakeRequest(requestId: number): Promise<boolean> {
  const attachments = await db
    .select({ s3Key: intakeAttachment.s3Key })
    .from(intakeAttachment)
    .where(eq(intakeAttachment.intakeRequestId, requestId));
  const [deleted] = await db
    .delete(intakeRequest)
    .where(eq(intakeRequest.id, requestId))
    .returning({ id: intakeRequest.id });
  if (!deleted) return false;
  for (const att of attachments) {
    await deleteAttachmentObject(att.s3Key);
  }
  return true;
}

function assertReviewable(row: typeof intakeRequest.$inferSelect): void {
  if (row.status !== 'pending' && row.status !== 'snoozed') {
    throw new HttpError(409, `Intake request is already ${row.status}`);
  }
}

function rewriteIntakeAttachmentUrls(text: string, publicIds: string[]): string {
  let out = text;
  for (const id of publicIds) {
    out = out.replaceAll(`/intake-attachments/${id}/raw`, `/attachments/${id}/raw`);
  }
  return out;
}

export async function acceptIntakeRequest(
  requestId: number,
  input: {
    assigneeUserId?: string | null;
    dueDate?: string | null;
    columnId?: number;
    typeId?: number | null;
    priority?: 'urgent' | 'high' | 'medium' | 'low' | null;
  },
  actorUserId: string | null,
): Promise<{ request: IntakeRequestDto; issue: IssueRow }> {
  const [row] = await db.select().from(intakeRequest).where(eq(intakeRequest.id, requestId));
  if (!row) throw new HttpError(404, 'Intake request not found');
  assertReviewable(row);

  const projectRow = await getProjectById(row.projectId);
  if (!projectRow) throw new HttpError(404, 'Project not found');

  let columnId = input.columnId;
  if (columnId == null) {
    const [firstCol] = await db
      .select({ id: projectColumn.id })
      .from(projectColumn)
      .where(eq(projectColumn.projectId, row.projectId))
      .orderBy(asc(projectColumn.position), asc(projectColumn.id))
      .limit(1);
    if (!firstCol) throw new HttpError(400, 'Project has no workflow columns');
    columnId = firstCol.id;
  }

  const [comments, attachments, reviewerName] = await Promise.all([
    db
      .select()
      .from(intakeComment)
      .where(eq(intakeComment.intakeRequestId, requestId))
      .orderBy(asc(intakeComment.createdAt), asc(intakeComment.id)),
    db
      .select()
      .from(intakeAttachment)
      .where(eq(intakeAttachment.intakeRequestId, requestId))
      .orderBy(asc(intakeAttachment.createdAt), asc(intakeAttachment.id)),
    resolveUserName(actorUserId),
  ]);

  const attachmentPublicIds = attachments.map((a) => a.publicId);
  const description = rewriteIntakeAttachmentUrls(row.description, attachmentPublicIds);

  const createdIssue = await createIssue(
    projectRow,
    {
      columnId,
      title: row.title,
      description,
      priority:
        input.priority !== undefined ? input.priority : (row.priority as IssueRow['priority']),
      assigneeUserId: input.assigneeUserId ?? null,
      dueDate: input.dueDate ?? null,
      typeId: input.typeId ?? null,
    },
    actorUserId,
  );

  const now = new Date();
  const [updated] = await db.transaction(async (tx) => {
    if (comments.length > 0) {
      await tx.insert(issueActivity).values(
        comments.map((c) => ({
          issueId: createdIssue.id,
          kind: 'comment' as const,
          actorUserId: c.actorUserId,
          actorName: c.actorName,
          body: rewriteIntakeAttachmentUrls(c.body, attachmentPublicIds),
          createdAt: c.createdAt,
        })),
      );
    }

    if (attachments.length > 0) {
      await tx.insert(issueAttachment).values(
        attachments.map((a) => ({
          publicId: a.publicId,
          issueId: createdIssue.id,
          s3Key: a.s3Key,
          filename: a.filename,
          contentType: a.contentType,
          sizeBytes: a.sizeBytes,
          createdAt: a.createdAt,
        })),
      );
      await tx.delete(intakeAttachment).where(eq(intakeAttachment.intakeRequestId, requestId));
    }

    return tx
      .update(intakeRequest)
      .set({
        status: 'accepted',
        acceptedIssueId: createdIssue.id,
        reviewedByUserId: actorUserId,
        reviewedByName: reviewerName,
        reviewedAt: now,
        snoozedUntil: null,
        updatedAt: now,
      })
      .where(eq(intakeRequest.id, requestId))
      .returning();
  });

  const [dto] = await hydrateRequests([updated]);
  await notifyIntakeOutcome({
    projectId: row.projectId,
    intakeRequestId: row.id,
    recipientUserId: row.submittedByUserId,
    actorUserId,
    type: 'intake_accepted',
    issueId: createdIssue.id,
  });
  await emitWebhookEvents(row.projectId, 'intake.accepted', async () => [dto], actorUserId);
  return { request: dto, issue: createdIssue };
}

export async function declineIntakeRequest(
  requestId: number,
  reason: string | null | undefined,
  actorUserId: string | null,
): Promise<IntakeRequestDto> {
  const [row] = await db.select().from(intakeRequest).where(eq(intakeRequest.id, requestId));
  if (!row) throw new HttpError(404, 'Intake request not found');
  assertReviewable(row);

  const reviewerName = await resolveUserName(actorUserId);
  const cleanedReason = reason?.replace(/[\r\n]+/g, ' ').trim() || null;
  const now = new Date();

  const [updated] = await db
    .update(intakeRequest)
    .set({
      status: 'declined',
      declineReason: cleanedReason,
      reviewedByUserId: actorUserId,
      reviewedByName: reviewerName,
      reviewedAt: now,
      snoozedUntil: null,
      updatedAt: now,
    })
    .where(eq(intakeRequest.id, requestId))
    .returning();

  const [dto] = await hydrateRequests([updated]);
  await notifyIntakeOutcome({
    projectId: row.projectId,
    intakeRequestId: row.id,
    recipientUserId: row.submittedByUserId,
    actorUserId,
    type: 'intake_declined',
  });
  await emitWebhookEvents(row.projectId, 'intake.declined', async () => [dto], actorUserId);
  return dto;
}

function parseSnoozeUntil(raw: string): Date {
  const trimmed = raw.trim();
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? new Date(`${trimmed}T00:00:00.000Z`)
    : new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new HttpError(400, 'Invalid snooze date');
  }
  if (parsed.getTime() <= Date.now()) {
    throw new HttpError(400, 'Snooze date must be in the future');
  }
  return parsed;
}

export async function snoozeIntakeRequest(
  requestId: number,
  untilRaw: string,
  actorUserId: string | null,
): Promise<IntakeRequestDto> {
  const [row] = await db.select().from(intakeRequest).where(eq(intakeRequest.id, requestId));
  if (!row) throw new HttpError(404, 'Intake request not found');
  assertReviewable(row);

  const snoozedUntil = parseSnoozeUntil(untilRaw);
  const reviewerName = await resolveUserName(actorUserId);
  const now = new Date();

  const [updated] = await db
    .update(intakeRequest)
    .set({
      status: 'snoozed',
      snoozedUntil,
      reviewedByUserId: actorUserId,
      reviewedByName: reviewerName,
      reviewedAt: now,
      updatedAt: now,
    })
    .where(eq(intakeRequest.id, requestId))
    .returning();

  const [dto] = await hydrateRequests([updated]);
  await notifyIntakeOutcome({
    projectId: row.projectId,
    intakeRequestId: row.id,
    recipientUserId: row.submittedByUserId,
    actorUserId,
    type: 'intake_snoozed',
  });
  await emitWebhookEvents(row.projectId, 'intake.snoozed', async () => [dto], actorUserId);
  return dto;
}

export async function markIntakeDuplicate(
  requestId: number,
  issueId: number,
  actorUserId: string | null,
): Promise<IntakeRequestDto> {
  const [row] = await db.select().from(intakeRequest).where(eq(intakeRequest.id, requestId));
  if (!row) throw new HttpError(404, 'Intake request not found');
  assertReviewable(row);

  const [targetIssue] = await db
    .select({ id: issue.id })
    .from(issue)
    .where(and(eq(issue.id, issueId), eq(issue.projectId, row.projectId)));
  if (!targetIssue) throw new HttpError(404, 'Issue not found in this project');

  const reviewerName = await resolveUserName(actorUserId);
  const now = new Date();

  const [updated] = await db
    .update(intakeRequest)
    .set({
      status: 'duplicate',
      duplicateOfIssueId: issueId,
      reviewedByUserId: actorUserId,
      reviewedByName: reviewerName,
      reviewedAt: now,
      snoozedUntil: null,
      updatedAt: now,
    })
    .where(eq(intakeRequest.id, requestId))
    .returning();

  const [dto] = await hydrateRequests([updated]);
  await notifyIntakeOutcome({
    projectId: row.projectId,
    intakeRequestId: row.id,
    recipientUserId: row.submittedByUserId,
    actorUserId,
    type: 'intake_duplicate',
    issueId,
  });
  await emitWebhookEvents(row.projectId, 'intake.duplicate', async () => [dto], actorUserId);
  return dto;
}

export async function listIntakeComments(requestId: number): Promise<IntakeCommentDto[]> {
  const rows = await db
    .select()
    .from(intakeComment)
    .where(eq(intakeComment.intakeRequestId, requestId))
    .orderBy(asc(intakeComment.createdAt), asc(intakeComment.id));
  return rows.map(mapComment);
}

export async function createIntakeComment(
  requestId: number,
  bodyRaw: string,
  actorUserId: string | null,
): Promise<IntakeCommentDto> {
  const body = bodyRaw.trim();
  if (!body) throw new HttpError(400, 'Comment body cannot be empty');
  const actorName = await resolveUserName(actorUserId);
  const [row] = await db
    .insert(intakeComment)
    .values({
      intakeRequestId: requestId,
      actorUserId,
      actorName,
      body,
    })
    .returning();
  return mapComment(row);
}

export async function deleteIntakeComment(commentId: number): Promise<boolean> {
  const [deleted] = await db
    .delete(intakeComment)
    .where(eq(intakeComment.id, commentId))
    .returning({ id: intakeComment.id });
  return Boolean(deleted);
}

export async function listIntakeAttachments(requestId: number): Promise<IntakeAttachmentDto[]> {
  const rows = await db
    .select()
    .from(intakeAttachment)
    .where(eq(intakeAttachment.intakeRequestId, requestId))
    .orderBy(asc(intakeAttachment.createdAt), asc(intakeAttachment.id));
  return rows.map(mapAttachmentDto);
}

export async function createIntakeAttachment(input: {
  projectId: number;
  intakeRequestId: number;
  s3Key: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
}): Promise<IntakeAttachmentDto> {
  return db.transaction(async (tx) => {
    await lockAttachmentStorage(tx, input.projectId);
    await assertAttachmentStorageCapacity(input.projectId, input.sizeBytes, 0, tx);
    const [row] = await tx
      .insert(intakeAttachment)
      .values({
        intakeRequestId: input.intakeRequestId,
        s3Key: input.s3Key,
        filename: input.filename,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
      })
      .returning();
    return mapAttachmentDto(row);
  });
}

export async function deleteIntakeAttachmentByPublicId(
  publicId: string,
): Promise<IntakeAttachmentRow | null> {
  const [row] = await db
    .delete(intakeAttachment)
    .where(eq(intakeAttachment.publicId, publicId))
    .returning();
  return row ? mapAttachmentRow(row) : null;
}
