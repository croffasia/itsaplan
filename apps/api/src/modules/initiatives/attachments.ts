import { db, initiative, initiativeAttachment } from '@repo/db';
import { eq, sql } from 'drizzle-orm';
import { iso, num } from '#shared/lib';
import {
  assertAttachmentStorageCapacity,
  lockAttachmentStorage,
  stripAttachmentEmbeds,
} from '#modules/attachments/storage';

// Data access for initiative attachments, the counterpart of the issue one in
// #modules/attachments/service.

export interface InitiativeAttachmentRow {
  publicId: string;
  initiativeId: number;
  s3Key: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
}

function mapRow(row: typeof initiativeAttachment.$inferSelect): InitiativeAttachmentRow {
  return {
    publicId: row.publicId,
    initiativeId: row.initiativeId,
    s3Key: row.s3Key,
    filename: row.filename,
    contentType: row.contentType,
    sizeBytes: num(row.sizeBytes),
    createdAt: iso(row.createdAt),
  };
}

export async function createInitiativeAttachment(input: {
  projectId: number;
  initiativeId: number;
  s3Key: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
}): Promise<InitiativeAttachmentRow> {
  return db.transaction(async (tx) => {
    await lockAttachmentStorage(tx, input.projectId);
    await assertAttachmentStorageCapacity(input.projectId, input.sizeBytes, 0, tx);
    const [row] = await tx
      .insert(initiativeAttachment)
      .values({
        initiativeId: input.initiativeId,
        s3Key: input.s3Key,
        filename: input.filename,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
      })
      .returning();
    return mapRow(row);
  });
}

export async function listInitiativeAttachments(
  initiativeId: number,
): Promise<InitiativeAttachmentRow[]> {
  const rows = await db
    .select()
    .from(initiativeAttachment)
    .where(eq(initiativeAttachment.initiativeId, initiativeId))
    .orderBy(initiativeAttachment.createdAt);
  return rows.map(mapRow);
}

export async function getInitiativeAttachment(
  publicId: string,
): Promise<InitiativeAttachmentRow | null> {
  const rows = await db
    .select()
    .from(initiativeAttachment)
    .where(eq(initiativeAttachment.publicId, publicId));
  return rows[0] ? mapRow(rows[0]) : null;
}

// The project an attachment belongs to, for the route guard.
export async function getInitiativeAttachmentProjectId(publicId: string): Promise<number | null> {
  const rows = await db
    .select({ projectId: initiative.projectId })
    .from(initiativeAttachment)
    .innerJoin(initiative, eq(initiative.id, initiativeAttachment.initiativeId))
    .where(eq(initiativeAttachment.publicId, publicId));
  return rows[0]?.projectId ?? null;
}

// Deletes the row and returns it, so the caller can remove the object it names
// from the store.
export async function deleteInitiativeAttachment(
  publicId: string,
): Promise<InitiativeAttachmentRow | null> {
  const rows = await db
    .delete(initiativeAttachment)
    .where(eq(initiativeAttachment.publicId, publicId))
    .returning();
  return rows[0] ? mapRow(rows[0]) : null;
}

// Called on delete so a removed attachment leaves no broken image behind.
export async function removeInitiativeAttachmentEmbeds(
  initiativeId: number,
  publicId: string,
): Promise<void> {
  const [row] = await db
    .select({ description: initiative.description })
    .from(initiative)
    .where(eq(initiative.id, initiativeId));
  if (!row) return;
  const next = stripAttachmentEmbeds(row.description, publicId);
  if (next === row.description) return;
  await db
    .update(initiative)
    .set({ description: next, updatedAt: sql`now()` })
    .where(eq(initiative.id, initiativeId));
}

// Every stored object of one initiative, read before the initiative is deleted so
// the caller can drop the bytes the cascade leaves behind.
export async function initiativeAttachmentKeys(initiativeId: number): Promise<string[]> {
  const rows = await db
    .select({ s3Key: initiativeAttachment.s3Key })
    .from(initiativeAttachment)
    .where(eq(initiativeAttachment.initiativeId, initiativeId));
  return rows.map((r) => r.s3Key);
}
