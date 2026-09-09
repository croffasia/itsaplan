import {
  db,
  initiative,
  issue,
  projectDocument,
  projectDocumentInitiative,
  projectDocumentIssue,
} from '@repo/db';
import { and, asc, eq, or } from 'drizzle-orm';
import { HttpError } from '#shared/lib';

export interface DocumentIssueLinkRow {
  issueId: number;
  sequenceNumber: number;
  identifier: string;
  title: string;
  archived: boolean;
  createdAt: string;
}

// The same shape serves both owners: a Docs page linked to an issue and one
// linked to an initiative are rendered by the same list.
export interface IssueDocumentLinkRow {
  documentId: number;
  title: string;
  icon: string | null;
  isPrivate: boolean;
  archived: boolean;
  createdAt: string;
}

function documentLinkRow(row: {
  documentId: number;
  title: string;
  icon: string | null;
  isPrivate: boolean;
  archivedAt: Date | null;
  createdAt: Date;
}): IssueDocumentLinkRow {
  return {
    documentId: row.documentId,
    title: row.title,
    icon: row.icon,
    isPrivate: row.isPrivate,
    archived: row.archivedAt !== null,
    createdAt: row.createdAt.toISOString(),
  };
}

const documentAccess = (userId: string) =>
  or(eq(projectDocument.isPrivate, false), eq(projectDocument.ownerUserId, userId));

async function visibleDocument(
  projectId: number,
  documentId: number,
  userId: string,
  tx: Pick<typeof db, 'select'> = db,
) {
  const [document] = await tx
    .select({
      id: projectDocument.id,
      title: projectDocument.title,
      icon: projectDocument.icon,
      isPrivate: projectDocument.isPrivate,
      archivedAt: projectDocument.archivedAt,
    })
    .from(projectDocument)
    .where(
      and(
        eq(projectDocument.id, documentId),
        eq(projectDocument.projectId, projectId),
        documentAccess(userId),
      ),
    )
    .limit(1);
  return document ?? null;
}

export async function listDocumentIssueLinks(
  projectId: number,
  projectKey: string,
  documentId: number,
  userId: string,
): Promise<DocumentIssueLinkRow[] | null> {
  if (!(await visibleDocument(projectId, documentId, userId))) return null;
  const rows = await db
    .select({
      issueId: issue.id,
      sequenceNumber: issue.sequenceNumber,
      title: issue.title,
      archivedAt: issue.archivedAt,
      createdAt: projectDocumentIssue.createdAt,
    })
    .from(projectDocumentIssue)
    .innerJoin(issue, eq(issue.id, projectDocumentIssue.issueId))
    .where(and(eq(projectDocumentIssue.documentId, documentId), eq(issue.projectId, projectId)))
    .orderBy(asc(issue.sequenceNumber));
  return rows.map((row) => ({
    issueId: row.issueId,
    sequenceNumber: row.sequenceNumber,
    identifier: `${projectKey}-${row.sequenceNumber}`,
    title: row.title,
    archived: row.archivedAt !== null,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function listIssueDocumentLinks(
  projectId: number,
  issueId: number,
  userId: string,
): Promise<IssueDocumentLinkRow[] | null> {
  const [workItem] = await db
    .select({ id: issue.id })
    .from(issue)
    .where(and(eq(issue.id, issueId), eq(issue.projectId, projectId)))
    .limit(1);
  if (!workItem) return null;

  const rows = await db
    .select({
      documentId: projectDocument.id,
      title: projectDocument.title,
      icon: projectDocument.icon,
      isPrivate: projectDocument.isPrivate,
      archivedAt: projectDocument.archivedAt,
      createdAt: projectDocumentIssue.createdAt,
    })
    .from(projectDocumentIssue)
    .innerJoin(projectDocument, eq(projectDocument.id, projectDocumentIssue.documentId))
    .where(
      and(
        eq(projectDocumentIssue.issueId, issueId),
        eq(projectDocument.projectId, projectId),
        documentAccess(userId),
      ),
    )
    .orderBy(asc(projectDocument.title), asc(projectDocument.id));
  return rows.map(documentLinkRow);
}

export async function addDocumentIssueLink(input: {
  projectId: number;
  projectKey: string;
  documentId: number;
  issueId: number;
  userId: string;
}): Promise<DocumentIssueLinkRow> {
  return db.transaction(async (tx) => {
    const document = await visibleDocument(input.projectId, input.documentId, input.userId, tx);
    if (!document) throw new HttpError(404, 'Document not found');
    if (document.archivedAt !== null)
      throw new HttpError(409, 'Archived documents cannot be linked');

    const [workItem] = await tx
      .select({
        id: issue.id,
        sequenceNumber: issue.sequenceNumber,
        title: issue.title,
        archivedAt: issue.archivedAt,
      })
      .from(issue)
      .where(and(eq(issue.id, input.issueId), eq(issue.projectId, input.projectId)))
      .limit(1);
    if (!workItem) throw new HttpError(404, 'Issue not found');

    const [created] = await tx
      .insert(projectDocumentIssue)
      .values({
        documentId: input.documentId,
        issueId: input.issueId,
        createdByUserId: input.userId,
      })
      .onConflictDoNothing()
      .returning({ createdAt: projectDocumentIssue.createdAt });
    if (!created) throw new HttpError(409, 'The document is already linked to this issue');

    return {
      issueId: workItem.id,
      sequenceNumber: workItem.sequenceNumber,
      identifier: `${input.projectKey}-${workItem.sequenceNumber}`,
      title: workItem.title,
      archived: workItem.archivedAt !== null,
      createdAt: created.createdAt.toISOString(),
    };
  });
}

export async function removeDocumentIssueLink(input: {
  projectId: number;
  documentId: number;
  issueId: number;
  userId: string;
}): Promise<boolean> {
  return db.transaction(async (tx) => {
    if (!(await visibleDocument(input.projectId, input.documentId, input.userId, tx))) {
      throw new HttpError(404, 'Document not found');
    }
    const [workItem] = await tx
      .select({ id: issue.id })
      .from(issue)
      .where(and(eq(issue.id, input.issueId), eq(issue.projectId, input.projectId)))
      .limit(1);
    if (!workItem) throw new HttpError(404, 'Issue not found');
    const removed = await tx
      .delete(projectDocumentIssue)
      .where(
        and(
          eq(projectDocumentIssue.documentId, input.documentId),
          eq(projectDocumentIssue.issueId, input.issueId),
        ),
      )
      .returning({ issueId: projectDocumentIssue.issueId });
    return removed.length > 0;
  });
}

export async function listInitiativeDocumentLinks(
  projectId: number,
  initiativeId: number,
  userId: string,
): Promise<IssueDocumentLinkRow[] | null> {
  const [target] = await db
    .select({ id: initiative.id })
    .from(initiative)
    .where(and(eq(initiative.id, initiativeId), eq(initiative.projectId, projectId)))
    .limit(1);
  if (!target) return null;

  const rows = await db
    .select({
      documentId: projectDocument.id,
      title: projectDocument.title,
      icon: projectDocument.icon,
      isPrivate: projectDocument.isPrivate,
      archivedAt: projectDocument.archivedAt,
      createdAt: projectDocumentInitiative.createdAt,
    })
    .from(projectDocumentInitiative)
    .innerJoin(projectDocument, eq(projectDocument.id, projectDocumentInitiative.documentId))
    .where(
      and(
        eq(projectDocumentInitiative.initiativeId, initiativeId),
        eq(projectDocument.projectId, projectId),
        documentAccess(userId),
      ),
    )
    .orderBy(asc(projectDocument.title), asc(projectDocument.id));
  return rows.map(documentLinkRow);
}

export async function addDocumentInitiativeLink(input: {
  projectId: number;
  documentId: number;
  initiativeId: number;
  userId: string;
}): Promise<IssueDocumentLinkRow> {
  return db.transaction(async (tx) => {
    const document = await visibleDocument(input.projectId, input.documentId, input.userId, tx);
    if (!document) throw new HttpError(404, 'Document not found');
    if (document.archivedAt !== null)
      throw new HttpError(409, 'Archived documents cannot be linked');

    const [target] = await tx
      .select({ id: initiative.id })
      .from(initiative)
      .where(and(eq(initiative.id, input.initiativeId), eq(initiative.projectId, input.projectId)))
      .limit(1);
    if (!target) throw new HttpError(404, 'Initiative not found');

    const [created] = await tx
      .insert(projectDocumentInitiative)
      .values({
        documentId: input.documentId,
        initiativeId: input.initiativeId,
        createdByUserId: input.userId,
      })
      .onConflictDoNothing()
      .returning({ createdAt: projectDocumentInitiative.createdAt });
    if (!created) throw new HttpError(409, 'The document is already linked to this initiative');

    return documentLinkRow({ ...document, documentId: document.id, createdAt: created.createdAt });
  });
}

export async function removeDocumentInitiativeLink(input: {
  projectId: number;
  documentId: number;
  initiativeId: number;
  userId: string;
}): Promise<boolean> {
  return db.transaction(async (tx) => {
    if (!(await visibleDocument(input.projectId, input.documentId, input.userId, tx))) {
      throw new HttpError(404, 'Document not found');
    }
    const removed = await tx
      .delete(projectDocumentInitiative)
      .where(
        and(
          eq(projectDocumentInitiative.documentId, input.documentId),
          eq(projectDocumentInitiative.initiativeId, input.initiativeId),
        ),
      )
      .returning({ initiativeId: projectDocumentInitiative.initiativeId });
    return removed.length > 0;
  });
}
