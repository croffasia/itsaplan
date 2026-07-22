import { db, issue, issueAttachment, issueFieldValue } from '@repo/db';
import { eq, sql } from 'drizzle-orm';
import { iso, num } from '../shared/lib';

// Data access for issue attachments. File bytes live in the S3-compatible object
// store (../shared/s3.ts); these rows hold the metadata and the object key. publicId is
// the unguessable id used in the public download URL.

export interface AttachmentRow {
  id: number;
  publicId: string;
  issueId: number;
  s3Key: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
}

export function mapAttachment(row: typeof issueAttachment.$inferSelect): AttachmentRow {
  return {
    id: row.id,
    publicId: row.publicId,
    issueId: row.issueId,
    s3Key: row.s3Key,
    filename: row.filename,
    contentType: row.contentType,
    sizeBytes: num(row.sizeBytes),
    createdAt: iso(row.createdAt),
  };
}

export async function createAttachment(input: {
  issueId: number;
  s3Key: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
}): Promise<AttachmentRow> {
  const [row] = await db
    .insert(issueAttachment)
    .values({
      issueId: input.issueId,
      s3Key: input.s3Key,
      filename: input.filename,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
    })
    .returning();
  return mapAttachment(row);
}

export async function listAttachments(issueId: number): Promise<AttachmentRow[]> {
  const rows = await db
    .select()
    .from(issueAttachment)
    .where(eq(issueAttachment.issueId, issueId))
    .orderBy(issueAttachment.createdAt);
  return rows.map(mapAttachment);
}

// Bytes currently stored for a project, across every issue in it. Read before an
// upload to enforce the instance project quota.
export async function getProjectAttachmentBytes(projectId: number): Promise<number> {
  const rows = await db
    .select({ total: sql<string>`coalesce(sum(${issueAttachment.sizeBytes}), 0)` })
    .from(issueAttachment)
    .innerJoin(issue, eq(issue.id, issueAttachment.issueId))
    .where(eq(issue.projectId, projectId));
  return num(rows[0]?.total ?? 0);
}

export async function getAttachmentByPublicId(publicId: string): Promise<AttachmentRow | null> {
  const rows = await db
    .select()
    .from(issueAttachment)
    .where(eq(issueAttachment.publicId, publicId));
  return rows[0] ? mapAttachment(rows[0]) : null;
}

// Deletes the row and returns it (with its s3Key) so the caller can remove the
// object from the store. Returns null if no row matched.
export async function deleteAttachmentByPublicId(publicId: string): Promise<AttachmentRow | null> {
  const rows = await db
    .delete(issueAttachment)
    .where(eq(issueAttachment.publicId, publicId))
    .returning();
  return rows[0] ? mapAttachment(rows[0]) : null;
}

// An embed of a deleted attachment left in markdown would 404 once the object is
// gone (or, worse, keep showing from the year-long immutable cache on the raw
// route). Strip any construct whose URL carries this attachment's publicId: a
// markdown image/link, or an inline <img>/<video>. The publicId is a uuid, so a
// URL substring match is specific to this one attachment.
function stripEmbeds(text: string, publicId: string): string {
  const id = publicId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text
    .replace(new RegExp(`!?\\[[^\\]]*\\]\\([^)]*${id}[^)]*\\)`, 'g'), '')
    .replace(new RegExp(`<img\\b[^>]*${id}[^>]*>`, 'g'), '')
    .replace(new RegExp(`<video\\b[^>]*${id}[^>]*>(?:\\s*</video>)?`, 'g'), '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Remove embeds of one attachment from the issue description and its markdown
// custom field values. Called on delete so a removed attachment leaves no broken
// image behind.
export async function removeAttachmentEmbeds(issueId: number, publicId: string): Promise<void> {
  let changed = false;

  const [row] = await db
    .select({ description: issue.description })
    .from(issue)
    .where(eq(issue.id, issueId));
  if (row) {
    const next = stripEmbeds(row.description, publicId);
    if (next !== row.description) {
      await db.update(issue).set({ description: next }).where(eq(issue.id, issueId));
      changed = true;
    }
  }

  const values = await db
    .select({ id: issueFieldValue.id, valueText: issueFieldValue.valueText })
    .from(issueFieldValue)
    .where(eq(issueFieldValue.issueId, issueId));
  for (const v of values) {
    if (v.valueText == null) continue;
    const next = stripEmbeds(v.valueText, publicId);
    if (next !== v.valueText) {
      await db.update(issueFieldValue).set({ valueText: next }).where(eq(issueFieldValue.id, v.id));
      changed = true;
    }
  }

  // issueRev is derived from issue.updatedAt; bump it so an open detail view
  // refetches the cleaned description and field values.
  if (changed) {
    await db
      .update(issue)
      .set({ updatedAt: sql`now()` })
      .where(eq(issue.id, issueId));
  }
}
