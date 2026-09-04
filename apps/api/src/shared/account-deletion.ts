import { db, documentAsset, projectDocument, user } from '@repo/db';
import { and, asc, eq, inArray, or, sql } from 'drizzle-orm';
import { deleteObjects } from './s3';

const DOCUMENT_TREE_LOCK_NAMESPACE = 1_145_390_931;

export async function deleteAccount(userId: string): Promise<boolean> {
  const result = await db.transaction(async (tx) => {
    const locked = await tx.execute(sql`select id from "user" where id = ${userId} for update`);
    if (locked.length === 0) return { deleted: false, assetKeys: [] as string[] };

    // Document writers take an actor lock before the project tree lock. Keep the
    // same ordering here so account deletion cannot race an autosave or move.
    const ownedDocuments = await tx
      .select({ projectId: projectDocument.projectId })
      .from(projectDocument)
      .where(eq(projectDocument.ownerUserId, userId));
    const projectIds = [...new Set(ownedDocuments.map((document) => document.projectId))].sort(
      (left, right) => left - right,
    );
    for (const projectId of projectIds) {
      await tx.execute(
        sql`select pg_advisory_xact_lock(${DOCUMENT_TREE_LOCK_NAMESPACE}, ${projectId})`,
      );
    }

    // Lock the pages before reading their asset keys. An upload that started before
    // account deletion either commits first and is included here, or observes the
    // deleted page and removes the newly written object in its failure cleanup.
    const privateDocuments = await tx
      .select({ id: projectDocument.id })
      .from(projectDocument)
      .where(and(eq(projectDocument.ownerUserId, userId), eq(projectDocument.isPrivate, true)))
      .for('update');
    const assets =
      privateDocuments.length === 0
        ? []
        : await tx
            .select({ s3Key: documentAsset.s3Key })
            .from(documentAsset)
            .where(
              inArray(
                documentAsset.documentId,
                privateDocuments.map((document) => document.id),
              ),
            );

    // Detach surviving pages explicitly before FK cleanup. This creates a new
    // optimistic version and immutable checkpoint instead of silently rewriting
    // the latest revision when a private parent or owner disappears.
    const privateDocumentIds = privateDocuments.map((document) => document.id);
    const affectedPublicDocuments = await tx
      .select({
        id: projectDocument.id,
        ownerUserId: projectDocument.ownerUserId,
        parentId: projectDocument.parentId,
      })
      .from(projectDocument)
      .where(
        and(
          eq(projectDocument.isPrivate, false),
          privateDocumentIds.length > 0
            ? or(
                eq(projectDocument.ownerUserId, userId),
                inArray(projectDocument.parentId, privateDocumentIds),
              )
            : eq(projectDocument.ownerUserId, userId),
        ),
      )
      .orderBy(asc(projectDocument.id))
      .for('update');
    for (const document of affectedPublicDocuments) {
      await tx
        .update(projectDocument)
        .set({
          ...(document.ownerUserId === userId ? { ownerUserId: null } : {}),
          ...(document.parentId !== null && privateDocumentIds.includes(document.parentId)
            ? { parentId: null }
            : {}),
          updatedByUserId: userId,
          updatedAt: sql`now()`,
          version: sql`${projectDocument.version} + 1`,
        })
        .where(eq(projectDocument.id, document.id));
    }

    await tx
      .delete(projectDocument)
      .where(and(eq(projectDocument.ownerUserId, userId), eq(projectDocument.isPrivate, true)));
    await tx.delete(user).where(eq(user.id, userId));
    return { deleted: true, assetKeys: assets.map((asset) => asset.s3Key) };
  });

  await deleteObjects(result.assetKeys);
  return result.deleted;
}
