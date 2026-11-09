import { db, documentComment } from '@repo/db';
import { user } from '@repo/db/schema';
import { and, asc, desc, eq, or } from 'drizzle-orm';
import { HttpError } from '#shared/lib';
import { addedMentionHandles, parseMentionHandles } from '#shared/mentions';
import { collaborationSchema } from './collaboration-schema';
import { lockVisibleDocument } from './collaboration';
import { fanOutCommentMentions } from './mentions';

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
    version?: number;
  },
) {
  const { comment, answeredUserId } = await db.transaction(async (tx) => {
    const document = await lockVisibleDocument(tx, projectId, documentId, userId);
    if (document.archivedAt) throw new HttpError(409, 'Archived documents cannot be commented on');
    if (!input.body.trim()) throw new HttpError(400, 'A comment cannot be empty');
    // A reply answers the comment just before it in the thread.
    let answeredUserId: string | null = null;
    if (input.parentId) {
      const [parent] = await tx
        .select()
        .from(documentComment)
        .where(
          and(eq(documentComment.id, input.parentId), eq(documentComment.documentId, documentId)),
        );
      if (!parent || parent.parentId) throw new HttpError(404, 'Comment thread not found');
      const [previous] = await tx
        .select({ authorId: documentComment.authorId })
        .from(documentComment)
        .where(or(eq(documentComment.id, parent.id), eq(documentComment.parentId, parent.id)))
        .orderBy(desc(documentComment.createdAt), desc(documentComment.id))
        .limit(1);
      answeredUserId = previous?.authorId ?? null;
    } else {
      if (input.version === undefined)
        throw new HttpError(400, 'A new thread needs the document version');
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
      .returning({ id: documentComment.id, body: documentComment.body });
    return { comment: comment!, answeredUserId };
  });
  await fanOutCommentMentions({
    projectId,
    documentId,
    comment: { ...comment, authorId: userId },
    handles: parseMentionHandles(comment.body),
    answeredUserId,
  });
  return { id: comment.id };
}
export async function updateDocumentComment(
  projectId: number,
  documentId: number,
  userId: string,
  commentId: string,
  input: { body?: string; resolved?: boolean },
) {
  const body = input.body?.trim();
  const comment = await db.transaction(async (tx) => {
    await lockVisibleDocument(tx, projectId, documentId, userId);
    const [comment] = await tx
      .select()
      .from(documentComment)
      .where(and(eq(documentComment.id, commentId), eq(documentComment.documentId, documentId)));
    if (!comment) throw new HttpError(404, 'Comment not found');
    if (body !== undefined && comment.authorId !== userId)
      throw new HttpError(403, 'Only the author can edit a comment');
    if (body === '') throw new HttpError(400, 'A comment cannot be empty');
    if (input.resolved !== undefined && comment.parentId)
      throw new HttpError(400, 'Resolve the thread, not a reply');
    await tx
      .update(documentComment)
      .set({
        ...(body !== undefined ? { body } : {}),
        ...(input.resolved !== undefined ? { resolvedAt: input.resolved ? new Date() : null } : {}),
        updatedAt: new Date(),
      })
      .where(eq(documentComment.id, commentId));
    return comment;
  });
  if (body !== undefined) {
    await fanOutCommentMentions({
      projectId,
      documentId,
      comment: { id: commentId, body, authorId: userId },
      handles: addedMentionHandles(comment.body, body),
    });
  }
  return { ok: true };
}
