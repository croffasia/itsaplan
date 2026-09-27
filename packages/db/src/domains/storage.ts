import { eq, sql } from 'drizzle-orm';
import { db, type DbExecutor } from '../client';
import { getSetting } from '../settings';
import {
  chatAttachment,
  documentAsset,
  initiative,
  initiativeAttachment,
  issue,
  issueAttachment,
  project,
  projectDocument,
} from '../schema';

// Instance-wide upload limits (app_setting key 'storage'). Read by the api (every
// upload path, and the settings/god UI) and by the worker (an imported Plane
// attachment is checked against the same limits an interactive upload would be).
// The api owns the write (modules/settings/service.ts's setStorageSettings).
//
// The row is seeded by migration 0046, so the limits are set in the database and
// edited in god mode — there is no env var for them. defaultStorageSettings() is
// the fallback for a missing row and the source of the seeded values; keep the two
// in sync.

export const STORAGE_SETTING_KEY = 'storage';

export const MB = 1024 * 1024;

export interface StorageSettings {
  // Upper bound on a single attachment. The multipart body is buffered in memory,
  // so this also bounds per-upload memory.
  maxAttachmentMb: number;
  // Upper bound on a single avatar image.
  maxAvatarMb: number;
  // Accepted attachment content types. An entry is a full type ('application/pdf')
  // or a wildcard ('image/*'). An empty list accepts any type.
  attachmentMimeTypes: string[];
  // Total stored attachment bytes allowed per project, in MB. 0 means unlimited.
  projectQuotaMb: number;
}

// Images, video, PDF, office documents and plain text formats. Executables,
// archives and anything else are refused until an admin adds them.
export const DEFAULT_ATTACHMENT_MIME_TYPES = [
  'image/*',
  'video/*',
  'application/pdf',
  'text/plain',
  'text/csv',
  'text/markdown',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.presentation',
];

export function defaultStorageSettings(): StorageSettings {
  return {
    maxAttachmentMb: 25,
    maxAvatarMb: 5,
    attachmentMimeTypes: DEFAULT_ATTACHMENT_MIME_TYPES,
    projectQuotaMb: 50 * 1024,
  };
}

export async function getStorageSettings(): Promise<StorageSettings> {
  const stored = await getSetting<Partial<StorageSettings>>(STORAGE_SETTING_KEY);
  // Merge over the default so a value written before a field was added stays valid.
  return { ...defaultStorageSettings(), ...(stored ?? {}) };
}

// Whether a content type passes the allowlist. An empty list accepts anything.
// Entries are matched case-insensitively; setStorageSettings normalizes what it stores.
export function mimeAllowed(contentType: string, allowed: string[]): boolean {
  if (allowed.length === 0) return true;
  const ct = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
  return allowed.some((pattern) =>
    pattern.endsWith('/*') ? ct.startsWith(pattern.slice(0, -1)) : ct === pattern,
  );
}

function num(value: unknown): number {
  return Number(value ?? 0);
}

const ATTACHMENT_QUOTA_LOCK_NAMESPACE = 1_145_390_932;

// Serializes a project's quota check against a concurrent one — two uploads (or
// an upload and an import) racing the same read-then-insert could otherwise
// both pass the check and land over quota together. Held for the rest of the
// caller's transaction (pg_advisory_xact_lock), so it must be called inside one.
export async function lockAttachmentStorage(
  executor: DbExecutor,
  projectId: number,
): Promise<void> {
  await executor.execute(
    sql`select pg_advisory_xact_lock(${ATTACHMENT_QUOTA_LOCK_NAMESPACE}, ${projectId})`,
  );
}

// Total attachment bytes a project has stored, across every kind that counts
// against its quota (issue, chat, document, initiative attachments) — what a new
// upload's size is checked against before it is allowed, and what a worker
// importing issue attachments checks against too. Runs against either the plain
// db or a transaction: a caller commonly checks capacity and inserts in the same
// transaction, so both must observe the same snapshot.
export async function projectStoredBytes(
  projectId: number,
  executor: DbExecutor = db,
): Promise<number> {
  const issues = await executor
    .select({ total: sql<string>`coalesce(sum(${issueAttachment.sizeBytes}), 0)` })
    .from(issueAttachment)
    .innerJoin(issue, eq(issue.id, issueAttachment.issueId))
    .where(eq(issue.projectId, projectId));
  const chats = await executor
    .select({ total: sql<string>`coalesce(sum(${chatAttachment.sizeBytes}), 0)` })
    .from(chatAttachment)
    .where(eq(chatAttachment.projectId, projectId));
  const documents = await executor
    .select({ total: sql<string>`coalesce(sum(${documentAsset.sizeBytes}), 0)` })
    .from(documentAsset)
    .innerJoin(projectDocument, eq(projectDocument.id, documentAsset.documentId))
    .where(eq(projectDocument.projectId, projectId));
  const initiatives = await executor
    .select({ total: sql<string>`coalesce(sum(${initiativeAttachment.sizeBytes}), 0)` })
    .from(initiativeAttachment)
    .innerJoin(initiative, eq(initiative.id, initiativeAttachment.initiativeId))
    .where(eq(initiative.projectId, projectId));
  return (
    num(issues[0]?.total) +
    num(chats[0]?.total) +
    num(documents[0]?.total) +
    num(initiatives[0]?.total)
  );
}

// The project's team, read through the same executor a quota check runs on — a
// copy checks the quota of a project its own transaction has not committed yet.
export async function projectTeamId(
  projectId: number,
  executor: DbExecutor = db,
): Promise<number | null> {
  const [owner] = await executor
    .select({ teamId: project.teamId })
    .from(project)
    .where(eq(project.id, projectId));
  return owner?.teamId ?? null;
}

// The same total as projectStoredBytes, summed across every project of one team —
// what a team-wide storage ceiling is checked against.
export async function teamStoredBytes(teamId: number, executor: DbExecutor = db): Promise<number> {
  const issues = await executor
    .select({ total: sql<string>`coalesce(sum(${issueAttachment.sizeBytes}), 0)` })
    .from(issueAttachment)
    .innerJoin(issue, eq(issue.id, issueAttachment.issueId))
    .innerJoin(project, eq(project.id, issue.projectId))
    .where(eq(project.teamId, teamId));
  const chats = await executor
    .select({ total: sql<string>`coalesce(sum(${chatAttachment.sizeBytes}), 0)` })
    .from(chatAttachment)
    .innerJoin(project, eq(project.id, chatAttachment.projectId))
    .where(eq(project.teamId, teamId));
  const documents = await executor
    .select({ total: sql<string>`coalesce(sum(${documentAsset.sizeBytes}), 0)` })
    .from(documentAsset)
    .innerJoin(projectDocument, eq(projectDocument.id, documentAsset.documentId))
    .innerJoin(project, eq(project.id, projectDocument.projectId))
    .where(eq(project.teamId, teamId));
  const initiatives = await executor
    .select({ total: sql<string>`coalesce(sum(${initiativeAttachment.sizeBytes}), 0)` })
    .from(initiativeAttachment)
    .innerJoin(initiative, eq(initiative.id, initiativeAttachment.initiativeId))
    .innerJoin(project, eq(project.id, initiative.projectId))
    .where(eq(project.teamId, teamId));
  return (
    num(issues[0]?.total) +
    num(chats[0]?.total) +
    num(documents[0]?.total) +
    num(initiatives[0]?.total)
  );
}
