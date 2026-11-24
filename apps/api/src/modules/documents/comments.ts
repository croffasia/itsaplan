import { db, documentComment, projectDocument } from '@repo/db';
import { user } from '@repo/db/schema';
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { HttpError, iso } from '#shared/lib';
import { addedMentionHandles, parseMentionHandles } from '#shared/mentions';
import { collaborationSchema } from './collaboration-schema';
import { lockVisibleDocument } from './collaboration';
import { documentVisibleTo } from './access';
import { fanOutCommentMentions } from './mentions';

// The open threads that wait for the user: on a live page they can open, the last message is
// someone else's, and the thread mentions the user or the user wrote in it. Newest first.
export async function listDocumentThreadsForUser(projectId: number, userId: string) {
  const [me] = await db.select({ username: user.username }).from(user).where(eq(user.id, userId));
  const handle = me?.username?.toLowerCase() ?? null;
  const root = alias(documentComment, 'root');
  // The ILIKE only narrows the read; the exact mention check runs on the text below.
  const threads = await db
    .selectDistinct({ id: root.id })
    .from(documentComment)
    .innerJoin(root, eq(root.id, sql`coalesce(${documentComment.parentId}, ${documentComment.id})`))
    .innerJoin(projectDocument, eq(projectDocument.id, documentComment.documentId))
    .where(
      and(
        eq(projectDocument.projectId, projectId),
        isNull(projectDocument.archivedAt),
        documentVisibleTo(userId),
        isNull(root.resolvedAt),
        eq(root.orphaned, false),
        or(
          eq(documentComment.authorId, userId),
          handle ? ilike(documentComment.body, `%@${handle}%`) : undefined,
        ),
      ),
    );
  if (threads.length === 0) return [];
  const ids = threads.map((thread) => thread.id);
  const rows = await db
    .select({
      id: documentComment.id,
      parentId: documentComment.parentId,
      authorId: documentComment.authorId,
      body: documentComment.body,
      createdAt: documentComment.createdAt,
      authorName: user.name,
      authorImage: user.image,
      documentId: projectDocument.id,
      documentTitle: projectDocument.title,
      documentIcon: projectDocument.icon,
    })
    .from(documentComment)
    .innerJoin(projectDocument, eq(projectDocument.id, documentComment.documentId))
    .leftJoin(user, eq(user.id, documentComment.authorId))
    .where(or(inArray(documentComment.id, ids), inArray(documentComment.parentId, ids)))
    .orderBy(asc(documentComment.createdAt), asc(documentComment.id));
  const byThread = new Map<string, typeof rows>();
  for (const row of rows) {
    const id = row.parentId ?? row.id;
    byThread.set(id, [...(byThread.get(id) ?? []), row]);
  }
  const mentions = (body: string) => handle !== null && parseMentionHandles(body).includes(handle);
  return [...byThread]
    .flatMap(([threadId, messages]) => {
      const last = messages.at(-1)!;
      if (last.authorId === userId) return [];
      if (!messages.some((m) => m.authorId === userId || mentions(m.body))) return [];
      return [
        {
          threadId,
          documentId: last.documentId,
          documentTitle: last.documentTitle,
          documentIcon: last.documentIcon,
          authorId: last.authorId,
          authorName: last.authorName,
          authorImage: last.authorImage,
          body: last.body,
          kind: mentions(last.body) ? ('mention' as const) : ('reply' as const),
          createdAt: last.createdAt,
        },
      ];
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((thread) => ({ ...thread, createdAt: iso(thread.createdAt) }));
}

export async function listDocumentComments(projectId: number, documentId: number, userId: string) {
  return db.transaction(async (tx) => {
    const document = await lockVisibleDocument(tx, projectId, documentId, userId);
    const resolver = alias(user, 'resolver');
    const rows = await tx
      .select({ comment: documentComment, authorName: user.name, resolvedByName: resolver.name })
      .from(documentComment)
      .leftJoin(user, eq(documentComment.authorId, user.id))
      .leftJoin(resolver, eq(documentComment.resolvedByUserId, resolver.id))
      .where(eq(documentComment.documentId, documentId))
      .orderBy(asc(documentComment.createdAt));
    return rows.map(
      ({ comment: { resolvedByUserId: _resolver, ...comment }, authorName, resolvedByName }) => ({
        ...comment,
        documentVersion: document.version,
        authorName,
        resolvedByName,
        createdAt: comment.createdAt.toISOString(),
        updatedAt: comment.updatedAt.toISOString(),
        resolvedAt: comment.resolvedAt?.toISOString() ?? null,
      }),
    );
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
        ...(input.resolved !== undefined
          ? {
              resolvedAt: input.resolved ? new Date() : null,
              resolvedByUserId: input.resolved ? userId : null,
            }
          : {}),
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
