import { db, documentComment } from '@repo/db';
import { user } from '@repo/db/schema';
import { and, asc, eq } from 'drizzle-orm';
import { HttpError } from '#shared/lib';
import { collaborationSchema } from './collaboration-schema';
import { lockVisibleDocument } from './collaboration';

export async function listDocumentComments(projectId: number, documentId: number, userId: string) {
  return db.transaction(async (tx) => {
    const document = await lockVisibleDocument(tx, projectId, documentId, userId);
    const rows = await tx
      .select({ comment: documentComment, authorName: user.name })
      .from(documentComment)
      .leftJoin(user, eq(documentComment.authorId, user.id))
      .where(eq(documentComment.documentId, documentId))
      .orderBy(asc(documentComment.createdAt));
    return rows.map(({ comment, authorName }) => ({
      ...comment,
      documentVersion: document.version,
      authorName,
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
      resolvedAt: comment.resolvedAt?.toISOString() ?? null,
    }));
  });
}
export async function addDocumentComment(
  projectId: number,
  documentId: number,
  userId: string,
  input: {
    body: string;
    parentId?: string;
    quote?: string;
    from?: number;
    to?: number;
    version: number;
  },
) {
  return db.transaction(async (tx) => {
    const document = await lockVisibleDocument(tx, projectId, documentId, userId);
    if (document.archivedAt) throw new HttpError(409, 'Archived documents cannot be commented on');
    if (!input.body.trim()) throw new HttpError(400, 'A comment cannot be empty');
    if (input.parentId) {
      const [parent] = await tx
        .select()
        .from(documentComment)
        .where(
          and(eq(documentComment.id, input.parentId), eq(documentComment.documentId, documentId)),
        );
      if (!parent || parent.parentId) throw new HttpError(404, 'Comment thread not found');
    } else {
      if (document.version !== input.version)
        throw new HttpError(409, 'The selection changed. Select the text again.');
      if (
        input.from === undefined ||
        input.to === undefined ||
        input.from >= input.to ||
        !input.quote?.trim()
      )
        throw new HttpError(400, 'Select text to comment on');
      if (!document.contentJson) throw new HttpError(409, 'Save the document first');
      const node = collaborationSchema.nodeFromJSON(document.contentJson);
      if (
        input.to > node.content.size ||
        node.textBetween(input.from, input.to, '\n').slice(0, 2000) !== input.quote
      )
        throw new HttpError(409, 'The selected text changed');
    }
    const [comment] = await tx
      .insert(documentComment)
      .values({
        documentId,
        authorId: userId,
        body: input.body.trim(),
        parentId: input.parentId ?? null,
        quote: input.parentId ? '' : input.quote,
        from: input.parentId ? null : input.from,
        to: input.parentId ? null : input.to,
      })
      .returning({ id: documentComment.id });
    return comment!;
  });
}
export async function updateDocumentComment(
  projectId: number,
  documentId: number,
  userId: string,
  commentId: string,
  input: { body?: string; resolved?: boolean },
) {
  await db.transaction(async (tx) => {
    await lockVisibleDocument(tx, projectId, documentId, userId);
    const [comment] = await tx
      .select()
      .from(documentComment)
      .where(and(eq(documentComment.id, commentId), eq(documentComment.documentId, documentId)));
    if (!comment) throw new HttpError(404, 'Comment not found');
    if (input.body !== undefined && comment.authorId !== userId)
      throw new HttpError(403, 'Only the author can edit a comment');
    if (input.body !== undefined && !input.body.trim())
      throw new HttpError(400, 'A comment cannot be empty');
    if (input.resolved !== undefined && comment.parentId)
      throw new HttpError(400, 'Resolve the thread, not a reply');
    await tx
      .update(documentComment)
      .set({
        ...(input.body !== undefined ? { body: input.body.trim() } : {}),
        ...(input.resolved !== undefined ? { resolvedAt: input.resolved ? new Date() : null } : {}),
        updatedAt: new Date(),
      })
      .where(eq(documentComment.id, commentId));
  });
  return { ok: true };
}
