import {
  db,
  documentCollaboration,
  documentComment,
  documentStep,
  projectDocument,
} from '@repo/db';
import { and, asc, eq, gt, lte, or } from 'drizzle-orm';
import { Step, Mapping } from '@tiptap/pm/transform';
import { HttpError } from '#shared/lib';
import { assertValidDocumentContentJson, getDocument } from './service';
import { collaborationSchema } from './collaboration-schema';

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export async function lockVisibleDocument(
  tx: Transaction,
  projectId: number,
  documentId: number,
  userId: string,
  editing = false,
) {
  const [document] = await tx
    .select()
    .from(projectDocument)
    .where(
      and(
        eq(projectDocument.id, documentId),
        eq(projectDocument.projectId, projectId),
        or(eq(projectDocument.isPrivate, false), eq(projectDocument.ownerUserId, userId)),
      ),
    )
    .for('update');
  if (!document) throw new HttpError(404, 'Document not found');
  if (editing && (document.isLocked || document.archivedAt))
    throw new HttpError(409, 'This document is read-only');
  return document;
}

export async function openDocumentSession(
  projectId: number,
  documentId: number,
  userId: string,
  input: { version: number; contentJson: Record<string, unknown> },
) {
  assertValidDocumentContentJson(input.contentJson);
  return db.transaction(async (tx) => {
    const document = await lockVisibleDocument(tx, projectId, documentId, userId, true);
    const [existing] = await tx
      .select()
      .from(documentCollaboration)
      .where(eq(documentCollaboration.documentId, documentId));
    if (existing && JSON.stringify(existing.contentJson) === JSON.stringify(document.contentJson))
      return existing;
    if (!document.contentJson && document.version !== input.version)
      throw new HttpError(409, 'Reload the document before joining');
    const json = document.contentJson ?? input.contentJson;
    assertValidDocumentContentJson(json);
    let normalized: Record<string, unknown>;
    try {
      const node = collaborationSchema.nodeFromJSON(json);
      node.check();
      normalized = node.toJSON();
      const ids = new Set<unknown>();
      const addIds = (value: Record<string, unknown>) => {
        if (
          [
            'paragraph',
            'heading',
            'blockquote',
            'codeBlock',
            'bulletList',
            'orderedList',
            'taskList',
            'table',
            'horizontalRule',
            'image',
          ].includes(String(value.type))
        ) {
          const attrs = (value.attrs ?? {}) as Record<string, unknown>;
          const id = attrs.blockId && !ids.has(attrs.blockId) ? attrs.blockId : crypto.randomUUID();
          ids.add(id);
          value.attrs = { ...attrs, blockId: id };
        }
        if (Array.isArray(value.content)) value.content.forEach(addIds);
      };
      addIds(normalized);
    } catch {
      throw new HttpError(400, 'Invalid document structure');
    }
    await tx.delete(documentStep).where(eq(documentStep.documentId, documentId));
    const [session] = await tx
      .insert(documentCollaboration)
      .values({ documentId, contentJson: normalized })
      .onConflictDoUpdate({
        target: documentCollaboration.documentId,
        set: { epoch: crypto.randomUUID(), version: 0, contentJson: normalized },
      })
      .returning();
    if (JSON.stringify(document.contentJson) !== JSON.stringify(normalized)) {
      await tx
        .update(projectDocument)
        .set({
          contentJson: normalized,
          version: document.version + 1,
          updatedByUserId: userId,
          updatedAt: new Date(),
        })
        .where(eq(projectDocument.id, documentId));
    }
    return session!;
  });
}

export async function getDocumentSteps(
  projectId: number,
  documentId: number,
  userId: string,
  epoch: string,
  version: number,
) {
  return db.transaction(async (tx) => {
    const document = await lockVisibleDocument(tx, projectId, documentId, userId);
    const [session] = await tx
      .select()
      .from(documentCollaboration)
      .where(eq(documentCollaboration.documentId, documentId));
    if (
      !session ||
      session.epoch !== epoch ||
      JSON.stringify(session.contentJson) !== JSON.stringify(document.contentJson)
    )
      throw new HttpError(409, 'The document was restored or replaced. Rejoin to continue.');
    if (version > session.version) throw new HttpError(409, 'Invalid collaboration version');
    const steps = await tx
      .select({
        version: documentStep.version,
        step: documentStep.step,
        clientId: documentStep.clientId,
      })
      .from(documentStep)
      .where(and(eq(documentStep.documentId, documentId), gt(documentStep.version, version)))
      .orderBy(asc(documentStep.version))
      .limit(1000);
    if (version < session.version && steps[0]?.version !== version + 1)
      throw new HttpError(409, 'The collaboration history expired. Rejoin to continue.');
    return {
      epoch,
      version: version + steps.length,
      steps: steps.map(({ step, clientId }) => ({ step, clientId })),
      hasMore: version + steps.length < session.version,
      documentVersion: document.version,
    };
  });
}

export async function saveDocumentSteps(
  projectId: number,
  documentId: number,
  userId: string,
  input: {
    epoch: string;
    version: number;
    clientId: string;
    steps: Record<string, unknown>[];
    content: string;
  },
) {
  await db.transaction(async (tx) => {
    const document = await lockVisibleDocument(tx, projectId, documentId, userId, true);
    const [session] = await tx
      .select()
      .from(documentCollaboration)
      .where(eq(documentCollaboration.documentId, documentId));
    if (
      !session ||
      session.epoch !== input.epoch ||
      JSON.stringify(session.contentJson) !== JSON.stringify(document.contentJson)
    )
      throw new HttpError(409, 'The document was restored or replaced');
    if (session.version !== input.version)
      throw new HttpError(409, 'Receive the latest changes before saving');
    let node = collaborationSchema.nodeFromJSON(session.contentJson);
    const mapping = new Mapping();
    const accepted: Record<string, unknown>[] = [];
    try {
      for (const json of input.steps) {
        const step = Step.fromJSON(collaborationSchema, json);
        const result = step.apply(node);
        if (result.failed || !result.doc) throw new Error('Invalid step');
        node = result.doc;
        mapping.appendMap(step.getMap());
        accepted.push(step.toJSON());
      }
      node.check();
    } catch {
      throw new HttpError(400, 'Invalid document changes');
    }
    const contentJson: Record<string, unknown> = node.toJSON();
    assertValidDocumentContentJson(contentJson);
    await tx.insert(documentStep).values(
      accepted.map((step, index) => ({
        documentId,
        version: input.version + index + 1,
        clientId: input.clientId,
        step,
      })),
    );
    await tx
      .update(documentCollaboration)
      .set({ version: input.version + input.steps.length, contentJson })
      .where(eq(documentCollaboration.documentId, documentId));
    await tx
      .update(projectDocument)
      .set({
        contentJson,
        content: input.content,
        version: document.version + 1,
        updatedAt: new Date(),
        updatedByUserId: userId,
      })
      .where(eq(projectDocument.id, documentId));
    const retainedFrom = input.version + input.steps.length - 10_000;
    if (retainedFrom > 0)
      await tx
        .delete(documentStep)
        .where(
          and(eq(documentStep.documentId, documentId), lte(documentStep.version, retainedFrom)),
        );
    const comments = await tx
      .select()
      .from(documentComment)
      .where(eq(documentComment.documentId, documentId));
    for (const comment of comments) {
      if (comment.from === null || comment.to === null || comment.orphaned) continue;
      const from = mapping.map(comment.from, 1);
      const to = mapping.map(comment.to, -1);
      if (from === comment.from && to === comment.to) continue;
      await tx
        .update(documentComment)
        .set({ from: Math.min(from, to), to: Math.max(from, to), orphaned: from >= to })
        .where(eq(documentComment.id, comment.id));
    }
  });
  return getDocument(projectId, documentId, userId);
}
