import {
  db,
  documentAsset,
  project,
  projectDocument,
  projectDocumentPreference,
  projectDocumentRevision,
  projectMember,
} from '@repo/db';
import { and, asc, desc, eq, ilike, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { HttpError, iso } from '#shared/lib';
import {
  assertAttachmentStorageCapacity,
  assertAttachmentFileAllowed,
  attachmentObjectKey,
  cloneAttachmentObject,
  deleteAttachmentObject,
  lockAttachmentStorage,
} from '#modules/attachments/storage';

type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

const DOCUMENT_TREE_LOCK_NAMESPACE = 1_145_390_931;

async function lockDocumentActor(executor: Executor, userId: string): Promise<void> {
  const rows = await executor.execute(
    sql`select id from "user" where id = ${userId} for key share`,
  );
  if (rows.length === 0) throw new HttpError(404, 'User not found');
}

async function lockDocumentActors(
  executor: Executor,
  userIds: Array<string | null>,
): Promise<void> {
  const ordered = [...new Set(userIds.filter((id): id is string => id !== null))].sort();
  for (const userId of ordered) await lockDocumentActor(executor, userId);
}

async function lockProjectDocumentActors(
  executor: Executor,
  projectId: number,
  actorUserId: string,
): Promise<void> {
  const rows = await executor
    .selectDistinct({ ownerUserId: projectDocument.ownerUserId })
    .from(projectDocument)
    .where(eq(projectDocument.projectId, projectId));
  await lockDocumentActors(executor, [actorUserId, ...rows.map((row) => row.ownerUserId)]);
}

export interface DocumentSummaryRow {
  id: number;
  projectId: number;
  parentId: number | null;
  title: string;
  icon: string | null;
  metadata: Record<string, unknown>;
  fullWidth: boolean;
  isPrivate: boolean;
  isLocked: boolean;
  isFavorite: boolean;
  archivedAt: string | null;
  position: number;
  version: number;
  ownerUserId: string | null;
  createdByUserId: string | null;
  updatedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentRow extends DocumentSummaryRow {
  content: string;
  contentJson: Record<string, unknown> | null;
}

export interface DocumentRevisionSummaryRow {
  id: number;
  documentId: number;
  version: number;
  title: string;
  createdByUserId: string | null;
  createdAt: string;
}

export interface DocumentRevisionRow extends DocumentRevisionSummaryRow {
  parentId: number | null;
  content: string;
  contentJson: Record<string, unknown> | null;
  icon: string | null;
  metadata: Record<string, unknown>;
  fullWidth: boolean;
  isPrivate: boolean;
  isLocked: boolean;
  archivedAt: string | null;
  position: number;
}

export interface DocumentAssetRow {
  publicId: string;
  documentId: number;
  uploadedByUserId: string | null;
  s3Key: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
}

function documentAccess(userId: string) {
  return or(eq(projectDocument.isPrivate, false), eq(projectDocument.ownerUserId, userId));
}

function mapDocument(row: typeof projectDocument.$inferSelect, isFavorite = false): DocumentRow {
  const { archivedByAncestorId: _archivedByAncestorId, ...publicRow } = row;
  return {
    ...publicRow,
    isFavorite,
    archivedAt: row.archivedAt ? iso(row.archivedAt) : null,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function summaryOf(
  row: typeof projectDocument.$inferSelect,
  isFavorite = false,
): DocumentSummaryRow {
  const { content: _content, contentJson: _contentJson, ...summary } = mapDocument(row, isFavorite);
  return summary;
}

function mapRevision(row: typeof projectDocumentRevision.$inferSelect): DocumentRevisionRow {
  const { ownerUserId: _ownerUserId, ...publicRow } = row;
  return {
    ...publicRow,
    archivedAt: row.archivedAt ? iso(row.archivedAt) : null,
    createdAt: iso(row.createdAt),
  };
}

function mapAsset(row: typeof documentAsset.$inferSelect): DocumentAssetRow {
  return { ...row, createdAt: iso(row.createdAt) };
}

export function replaceAssetReferences<T>(
  value: T,
  sourceDocumentId: number,
  targetProjectKey: string,
  targetDocumentId: number,
  publicIds: Map<string, string>,
): T {
  if (typeof value === 'string') {
    const replaced = value.replace(
      new RegExp(
        `(/(?:protected-)?media)?/projects/[^/\\s"']+/documents/${sourceDocumentId}/assets/([0-9a-f-]{36})/raw`,
        'gi',
      ),
      (match, mediaPrefix: string | undefined, publicId: string) => {
        const targetPublicId = publicIds.get(publicId.toLowerCase());
        return targetPublicId
          ? `${mediaPrefix ?? ''}/projects/${encodeURIComponent(targetProjectKey)}/documents/${targetDocumentId}/assets/${targetPublicId}/raw`
          : match;
      },
    );
    return replaced as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) =>
      replaceAssetReferences(item, sourceDocumentId, targetProjectKey, targetDocumentId, publicIds),
    ) as T;
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        replaceAssetReferences(
          item,
          sourceDocumentId,
          targetProjectKey,
          targetDocumentId,
          publicIds,
        ),
      ]),
    ) as T;
  }
  return value;
}

function revisionSummaryOf(
  row: typeof projectDocumentRevision.$inferSelect,
): DocumentRevisionSummaryRow {
  const {
    parentId: _parentId,
    content: _content,
    contentJson: _contentJson,
    icon: _icon,
    metadata: _metadata,
    fullWidth: _fullWidth,
    isPrivate: _isPrivate,
    isLocked: _isLocked,
    archivedAt: _archivedAt,
    position: _position,
    ...summary
  } = mapRevision(row);
  return summary;
}

async function favoriteDocumentIds(
  executor: Executor,
  userId: string,
  documentIds: number[],
): Promise<Set<number>> {
  if (documentIds.length === 0) return new Set();
  const rows = await executor
    .select({ documentId: projectDocumentPreference.documentId })
    .from(projectDocumentPreference)
    .where(
      and(
        eq(projectDocumentPreference.userId, userId),
        eq(projectDocumentPreference.isFavorite, true),
        inArray(projectDocumentPreference.documentId, documentIds),
      ),
    );
  return new Set(rows.map((row) => row.documentId));
}

export async function listDocuments(
  projectId: number,
  userId: string,
  options: { q?: string; archived?: boolean } = {},
): Promise<DocumentSummaryRow[]> {
  const term = options.q?.trim();
  const conditions = [
    eq(projectDocument.projectId, projectId),
    documentAccess(userId),
    options.archived ? isNotNull(projectDocument.archivedAt) : isNull(projectDocument.archivedAt),
  ];
  if (term) {
    conditions.push(
      or(ilike(projectDocument.title, `%${term}%`), ilike(projectDocument.content, `%${term}%`)),
    );
  }
  const rows = await db
    .select()
    .from(projectDocument)
    .where(and(...conditions))
    .orderBy(asc(projectDocument.position), asc(projectDocument.id));
  const visibleIds = new Set(rows.map((row) => row.id));
  const favorites = await favoriteDocumentIds(
    db,
    userId,
    rows.map((row) => row.id),
  );
  return rows.map((row) => ({
    ...summaryOf(row, favorites.has(row.id)),
    parentId: row.parentId !== null && visibleIds.has(row.parentId) ? row.parentId : null,
  }));
}

async function selectDocument(
  executor: Executor,
  projectId: number,
  documentId: number,
  userId: string,
) {
  const [row] = await executor
    .select()
    .from(projectDocument)
    .where(
      and(
        eq(projectDocument.id, documentId),
        eq(projectDocument.projectId, projectId),
        documentAccess(userId),
      ),
    );
  return row ?? null;
}

export async function getDocument(
  projectId: number,
  documentId: number,
  userId: string,
): Promise<DocumentRow | null> {
  const row = await selectDocument(db, projectId, documentId, userId);
  if (!row) return null;
  return mapDocumentForUser(db, row, userId);
}

export async function listDocumentAssets(
  projectId: number,
  documentId: number,
  userId: string,
): Promise<DocumentAssetRow[] | null> {
  if (!(await selectDocument(db, projectId, documentId, userId))) return null;
  const rows = await db
    .select()
    .from(documentAsset)
    .where(eq(documentAsset.documentId, documentId))
    .orderBy(asc(documentAsset.createdAt), asc(documentAsset.id));
  return rows.map(mapAsset);
}

export async function assertDocumentAssetUploadTarget(
  projectId: number,
  documentId: number,
  userId: string,
): Promise<boolean> {
  const current = await selectDocument(db, projectId, documentId, userId);
  if (!current) return false;
  assertActive(current);
  assertUnlocked(current);
  return true;
}

export async function createDocumentAsset(input: {
  projectId: number;
  documentId: number;
  userId: string;
  s3Key: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
}): Promise<DocumentAssetRow | null> {
  return db.transaction(async (tx) => {
    // Global lock order for asset writes is quota -> actor -> document. Holding
    // KEY SHARE prevents account deletion from taking the user row and then
    // waiting on this document while the asset FK waits back on the user.
    await lockAttachmentStorage(tx, input.projectId);
    await lockDocumentActor(tx, input.userId);
    await assertAttachmentStorageCapacity(input.projectId, input.sizeBytes, 0, tx);
    await tx.execute(
      sql`select 1 from ${projectDocument} where ${projectDocument.id} = ${input.documentId} and ${projectDocument.projectId} = ${input.projectId} for update`,
    );
    const current = await selectDocument(tx, input.projectId, input.documentId, input.userId);
    if (!current) return null;
    assertActive(current);
    assertUnlocked(current);
    const [row] = await tx
      .insert(documentAsset)
      .values({
        documentId: input.documentId,
        uploadedByUserId: input.userId,
        s3Key: input.s3Key,
        filename: input.filename,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
      })
      .returning();
    return mapAsset(row);
  });
}

export async function getDocumentAsset(
  projectId: number,
  documentId: number,
  publicId: string,
  userId: string,
): Promise<DocumentAssetRow | null> {
  if (!(await selectDocument(db, projectId, documentId, userId))) return null;
  const [row] = await db
    .select()
    .from(documentAsset)
    .where(and(eq(documentAsset.documentId, documentId), eq(documentAsset.publicId, publicId)));
  return row ? mapAsset(row) : null;
}

export async function deleteDocumentAsset(
  projectId: number,
  documentId: number,
  publicId: string,
  userId: string,
  isProjectOwner: boolean,
): Promise<DocumentAssetRow | null> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select 1 from ${projectDocument} where ${projectDocument.id} = ${documentId} and ${projectDocument.projectId} = ${projectId} for update`,
    );
    const current = await ownedDocument(tx, projectId, documentId, userId, isProjectOwner);
    if (!current) return null;
    assertActive(current);
    assertUnlocked(current);
    const [row] = await tx
      .delete(documentAsset)
      .where(and(eq(documentAsset.documentId, documentId), eq(documentAsset.publicId, publicId)))
      .returning();
    return row ? mapAsset(row) : null;
  });
}

async function mapDocumentForUser(
  executor: Executor,
  row: typeof projectDocument.$inferSelect,
  userId: string,
): Promise<DocumentRow> {
  const favorites = await favoriteDocumentIds(executor, userId, [row.id]);
  const parentId = await visibleDocumentParentId(executor, row.projectId, row.parentId, userId);
  return mapDocument({ ...row, parentId }, favorites.has(row.id));
}

async function visibleDocumentParentId(
  executor: Executor,
  projectId: number,
  parentId: number | null,
  userId: string,
): Promise<number | null> {
  if (parentId === null) return null;
  const [parent] = await executor
    .select({ id: projectDocument.id })
    .from(projectDocument)
    .where(
      and(
        eq(projectDocument.id, parentId),
        eq(projectDocument.projectId, projectId),
        documentAccess(userId),
      ),
    );
  return parent?.id ?? null;
}

async function assertValidParent(
  executor: Executor,
  projectId: number,
  documentId: number | null,
  parentId: number | null,
  userId: string,
): Promise<void> {
  let cursor = parentId;
  const seen = new Set<number>();
  while (cursor !== null) {
    if (cursor === documentId || seen.has(cursor)) {
      throw new HttpError(400, 'A document cannot be nested inside itself');
    }
    seen.add(cursor);
    const [parent] = await executor
      .select({
        projectId: projectDocument.projectId,
        parentId: projectDocument.parentId,
        archivedAt: projectDocument.archivedAt,
      })
      .from(projectDocument)
      .where(and(eq(projectDocument.id, cursor), documentAccess(userId)));
    if (!parent || parent.projectId !== projectId) {
      throw new HttpError(400, 'Parent document must belong to the same project');
    }
    if (parent.archivedAt !== null) {
      throw new HttpError(400, 'An archived document cannot be used as a parent');
    }
    cursor = parent.parentId;
  }
}

async function nextPosition(
  executor: Executor,
  projectId: number,
  parentId: number | null,
): Promise<number> {
  const sameParent =
    parentId === null ? isNull(projectDocument.parentId) : eq(projectDocument.parentId, parentId);
  const [row] = await executor
    .select({ value: sql<number>`coalesce(max(${projectDocument.position}), 0) + 1024` })
    .from(projectDocument)
    .where(
      and(eq(projectDocument.projectId, projectId), isNull(projectDocument.archivedAt), sameParent),
    );
  return Number(row?.value ?? 1024);
}

interface DocumentMovePlan {
  position: number;
  siblingPositions: Array<{ id: number; position: number }>;
}

function safeDocumentPosition(
  previous: { position: number } | undefined,
  next: { position: number } | undefined,
  occupied: Array<{ position: number }>,
): number | null {
  let candidate: number;
  if (!previous && !next) candidate = 1024;
  else if (!previous) candidate = next!.position - 1024;
  else if (!next) candidate = previous.position + 1024;
  else {
    const gap = next.position - previous.position;
    const scale = Math.max(1, Math.abs(previous.position), Math.abs(next.position));
    if (!Number.isFinite(gap) || gap <= Number.EPSILON * scale * 4) return null;
    candidate = previous.position + gap / 2;
    if (!(candidate > previous.position && candidate < next.position)) return null;
  }
  if (!Number.isFinite(candidate)) return null;
  return occupied.some((sibling) => sibling.position === candidate) ? null : candidate;
}

async function planDocumentMove(
  executor: Executor,
  projectId: number,
  documentId: number,
  parentId: number | null,
  previousSiblingId: number | null,
  nextSiblingId: number | null,
): Promise<DocumentMovePlan> {
  if (previousSiblingId === documentId || nextSiblingId === documentId) {
    throw new HttpError(400, 'A document cannot be its own move anchor.');
  }
  const sameParent =
    parentId === null ? isNull(projectDocument.parentId) : eq(projectDocument.parentId, parentId);
  const siblings = (
    await executor
      .select({ id: projectDocument.id, position: projectDocument.position })
      .from(projectDocument)
      .where(
        and(
          eq(projectDocument.projectId, projectId),
          sameParent,
          isNull(projectDocument.archivedAt),
        ),
      )
      .orderBy(asc(projectDocument.position), asc(projectDocument.id))
  ).filter((sibling) => sibling.id !== documentId);

  const previousIndex =
    previousSiblingId === null
      ? -1
      : siblings.findIndex((sibling) => sibling.id === previousSiblingId);
  const nextIndex =
    nextSiblingId === null
      ? siblings.length
      : siblings.findIndex((sibling) => sibling.id === nextSiblingId);
  if (
    (previousSiblingId !== null && previousIndex < 0) ||
    (nextSiblingId !== null && nextIndex < 0) ||
    (previousSiblingId !== null && nextSiblingId !== null && previousIndex >= nextIndex)
  ) {
    throw new HttpError(409, 'Document order changed elsewhere. Reload it before moving.');
  }

  // Private siblings invisible to this caller may sit between two visible
  // anchors. Preserve their relative order and place the moved page immediately
  // after the previous anchor (or immediately before the next one at the start).
  const insertionIndex =
    previousSiblingId !== null ? previousIndex + 1 : nextSiblingId !== null ? nextIndex : 0;
  const candidate = safeDocumentPosition(
    siblings[insertionIndex - 1],
    siblings[insertionIndex],
    siblings,
  );
  if (candidate !== null) return { position: candidate, siblingPositions: [] };

  const orderedIds = siblings.map((sibling) => sibling.id);
  orderedIds.splice(insertionIndex, 0, documentId);
  return {
    position: (insertionIndex + 1) * 1024,
    siblingPositions: orderedIds.map((id, index) => ({ id, position: (index + 1) * 1024 })),
  };
}

export async function createDocument(input: {
  projectId: number;
  userId: string;
  title?: string;
  content?: string;
  contentJson?: Record<string, unknown> | null;
  icon?: string | null;
  metadata?: Record<string, unknown>;
  fullWidth?: boolean;
  isPrivate?: boolean;
  parentId?: number | null;
}): Promise<DocumentRow> {
  assertValidDocumentContentJson(input.contentJson);
  assertValidMetadata(input.metadata);
  const parentId = input.parentId ?? null;
  return db.transaction(async (tx) => {
    await lockDocumentActor(tx, input.userId);
    await tx.execute(
      sql`select pg_advisory_xact_lock(${DOCUMENT_TREE_LOCK_NAMESPACE}, ${input.projectId})`,
    );
    await assertValidParent(tx, input.projectId, null, parentId, input.userId);
    const [row] = await tx
      .insert(projectDocument)
      .values({
        projectId: input.projectId,
        parentId,
        title: input.title ?? '',
        content: input.content ?? '',
        contentJson: input.contentJson ?? null,
        icon: input.icon,
        metadata: input.metadata ?? {},
        fullWidth: input.fullWidth ?? false,
        isPrivate: input.isPrivate ?? false,
        position: await nextPosition(tx, input.projectId, parentId),
        ownerUserId: input.userId,
        createdByUserId: input.userId,
        updatedByUserId: input.userId,
      })
      .returning();
    return mapDocumentForUser(tx, row, input.userId);
  });
}

function assertExpectedVersion(row: { version: number }, expected: number): void {
  if (row.version !== expected) {
    throw new HttpError(409, 'This document changed elsewhere. Reload it before continuing.');
  }
}

function assertActive(row: { archivedAt: Date | null }): void {
  if (row.archivedAt !== null) {
    throw new HttpError(409, 'Restore this document before changing it.');
  }
}

function assertUnlocked(row: { isLocked: boolean }): void {
  if (row.isLocked) {
    throw new HttpError(409, 'Unlock this document before changing it.');
  }
}

const MAX_DOCUMENT_JSON_BYTES = 1_000_000;
const MAX_DOCUMENT_JSON_NODES = 10_000;
const MAX_DOCUMENT_JSON_DEPTH = 100;
const MAX_DOCUMENT_METADATA_BYTES = 16_384;
const DOCUMENT_NODE_TYPES = new Set([
  'doc',
  'paragraph',
  'text',
  'blockquote',
  'bulletList',
  'orderedList',
  'listItem',
  'heading',
  'horizontalRule',
  'hardBreak',
  'codeBlock',
  'image',
  'table',
  'tableRow',
  'tableHeader',
  'tableCell',
  'taskList',
  'taskItem',
]);
const DOCUMENT_MARK_TYPES = new Set([
  'bold',
  'italic',
  'strike',
  'code',
  'link',
  'textStyle',
  'underline',
  'highlight',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertJsonByteSize(value: unknown, maximum: number, field: string): void {
  let bytes: number;
  try {
    bytes = Buffer.byteLength(JSON.stringify(value), 'utf8');
  } catch {
    throw new HttpError(400, `${field} must contain valid JSON values.`);
  }
  if (bytes > maximum) throw new HttpError(400, `${field} exceeds the ${maximum} byte limit.`);
}

function documentAttributes(value: Record<string, unknown>): Record<string, unknown> {
  if (value.attrs == null) return {};
  if (!isRecord(value.attrs)) throw new HttpError(400, 'Document attrs must be an object.');
  return value.attrs;
}

function assertAllowedAttributes(
  attrs: Record<string, unknown>,
  allowed: readonly string[],
  context: string,
): void {
  const allowedKeys = new Set(allowed);
  const unknown = Object.keys(attrs).find((key) => !allowedKeys.has(key));
  if (unknown) throw new HttpError(400, `${context} contains an unsupported "${unknown}" attr.`);
}

function assertOptionalBoundedString(value: unknown, maximum: number, context: string): void {
  if (value == null) return;
  if (typeof value !== 'string' || value.length > maximum) {
    throw new HttpError(400, `${context} must be a string no longer than ${maximum} characters.`);
  }
}

function containsUnsafeUrlCharacter(value: string): boolean {
  return [...value].some(
    (character) => character === '\\' || /[\p{White_Space}\p{Cc}\p{Cf}]/u.test(character),
  );
}

function assertSafeLinkHref(value: unknown): void {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2_048) {
    throw new HttpError(400, 'A link href must be a non-empty string up to 2048 characters.');
  }
  if (containsUnsafeUrlCharacter(value)) {
    throw new HttpError(400, 'A link href cannot contain whitespace, controls, or backslashes.');
  }
  if (value.startsWith('#')) return;
  if (value.startsWith('/') && !value.startsWith('//')) return;
  if (/^(mailto:|tel:)/i.test(value)) {
    if (value.slice(value.indexOf(':') + 1).length > 0) return;
    throw new HttpError(400, 'A mailto or tel link must contain a destination.');
  }
  try {
    const parsed = new URL(value);
    if (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      !parsed.username &&
      !parsed.password
    ) {
      return;
    }
  } catch {
    // Fall through to the uniform validation error below.
  }
  throw new HttpError(400, 'A link href must use http, https, mailto, tel, /path, or #anchor.');
}

const DOCUMENT_ASSET_PATH =
  /^\/(?:protected-media\/)?projects\/[A-Za-z0-9._~%+-]+\/documents\/[1-9]\d*\/assets\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/raw$/i;

function assertSafeImageSource(value: unknown): void {
  if (typeof value !== 'string' || value.length === 0 || value.length > 4_096) {
    throw new HttpError(400, 'An image src must be a non-empty string up to 4096 characters.');
  }
  if (containsUnsafeUrlCharacter(value)) {
    throw new HttpError(400, 'An image src cannot contain whitespace, controls, or backslashes.');
  }
  if (DOCUMENT_ASSET_PATH.test(value)) return;
  try {
    const parsed = new URL(value);
    if (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      !parsed.username &&
      !parsed.password
    ) {
      return;
    }
  } catch {
    // Fall through to the uniform validation error below.
  }
  throw new HttpError(400, 'An image src must use http, https, or a protected Docs asset URL.');
}

function assertSafeColor(value: unknown): void {
  if (
    value !== undefined &&
    value !== null &&
    (typeof value !== 'string' ||
      !/^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value))
  ) {
    throw new HttpError(400, 'Document colors must use a hexadecimal color value.');
  }
}

function assertDocumentNodeAttributes(node: Record<string, unknown>): void {
  const attrs = documentAttributes(node);
  switch (node.type) {
    case 'paragraph':
      assertAllowedAttributes(attrs, ['textAlign'], 'A paragraph');
      if (
        attrs.textAlign != null &&
        !['left', 'center', 'right'].includes(String(attrs.textAlign))
      ) {
        throw new HttpError(400, 'Paragraph textAlign must be left, center, or right.');
      }
      return;
    case 'heading':
      assertAllowedAttributes(attrs, ['level', 'textAlign'], 'A heading');
      if (!Number.isInteger(attrs.level) || Number(attrs.level) < 1 || Number(attrs.level) > 6) {
        throw new HttpError(400, 'Heading level must be an integer from 1 to 6.');
      }
      if (
        attrs.textAlign != null &&
        !['left', 'center', 'right'].includes(String(attrs.textAlign))
      ) {
        throw new HttpError(400, 'Heading textAlign must be left, center, or right.');
      }
      return;
    case 'image': {
      assertAllowedAttributes(attrs, ['src', 'alt', 'title', 'width', 'style'], 'An image');
      assertSafeImageSource(attrs.src);
      assertOptionalBoundedString(attrs.alt, 1_000, 'Image alt');
      assertOptionalBoundedString(attrs.title, 1_000, 'Image title');
      if (
        attrs.width != null &&
        (!Number.isInteger(attrs.width) || Number(attrs.width) < 1 || Number(attrs.width) > 4_096)
      ) {
        throw new HttpError(400, 'Image width must be an integer from 1 to 4096.');
      }
      if (
        attrs.style != null &&
        (typeof attrs.style !== 'string' || !/^max-width: *(?:100|[1-9]\d?)%;?$/i.test(attrs.style))
      ) {
        throw new HttpError(400, 'Image style may only contain a max-width percentage.');
      }
      return;
    }
    case 'taskItem':
      assertAllowedAttributes(attrs, ['checked'], 'A task item');
      if (attrs.checked !== undefined && typeof attrs.checked !== 'boolean') {
        throw new HttpError(400, 'Task item checked must be a boolean.');
      }
      return;
    case 'tableCell':
    case 'tableHeader': {
      assertAllowedAttributes(attrs, ['colspan', 'rowspan', 'colwidth'], 'A table cell');
      for (const key of ['colspan', 'rowspan'] as const) {
        const span = attrs[key];
        if (
          span !== undefined &&
          (!Number.isInteger(span) || Number(span) < 1 || Number(span) > 100)
        ) {
          throw new HttpError(400, `Table ${key} must be an integer from 1 to 100.`);
        }
      }
      if (
        attrs.colwidth != null &&
        (!Array.isArray(attrs.colwidth) ||
          attrs.colwidth.length === 0 ||
          attrs.colwidth.length > 100 ||
          attrs.colwidth.some(
            (width) => !Number.isInteger(width) || Number(width) < 1 || Number(width) > 10_000,
          ))
      ) {
        throw new HttpError(400, 'Table colwidth must contain positive integer widths.');
      }
      return;
    }
    case 'orderedList':
      assertAllowedAttributes(attrs, ['start'], 'An ordered list');
      if (
        attrs.start !== undefined &&
        (!Number.isInteger(attrs.start) ||
          Number(attrs.start) < 1 ||
          Number(attrs.start) > 1_000_000)
      ) {
        throw new HttpError(400, 'Ordered-list start must be a positive integer.');
      }
      return;
    case 'codeBlock':
      assertAllowedAttributes(attrs, ['language'], 'A code block');
      assertOptionalBoundedString(attrs.language, 100, 'Code-block language');
      return;
    default:
      assertAllowedAttributes(attrs, [], `A ${String(node.type)} node`);
  }
}

function assertDocumentMarkAttributes(mark: Record<string, unknown>): void {
  const attrs = documentAttributes(mark);
  switch (mark.type) {
    case 'link':
      assertAllowedAttributes(attrs, ['href', 'target', 'rel', 'class'], 'A link');
      assertSafeLinkHref(attrs.href);
      if (attrs.target != null && !['_blank', '_self'].includes(String(attrs.target))) {
        throw new HttpError(400, 'Link target must be _blank or _self.');
      }
      assertOptionalBoundedString(attrs.rel, 200, 'Link rel');
      if (typeof attrs.rel === 'string' && !/^[a-z -]*$/i.test(attrs.rel)) {
        throw new HttpError(400, 'Link rel contains unsupported characters.');
      }
      assertOptionalBoundedString(attrs.class, 200, 'Link class');
      if (typeof attrs.class === 'string' && !/^[a-z0-9 _-]*$/i.test(attrs.class)) {
        throw new HttpError(400, 'Link class contains unsupported characters.');
      }
      return;
    case 'textStyle':
    case 'highlight':
      assertAllowedAttributes(attrs, ['color'], `A ${String(mark.type)} mark`);
      assertSafeColor(attrs.color);
      return;
    default:
      assertAllowedAttributes(attrs, [], `A ${String(mark.type)} mark`);
  }
}

function assertDocumentJsonNode(value: unknown, depth: number, counter: { value: number }): void {
  if (!isRecord(value) || typeof value.type !== 'string' || !DOCUMENT_NODE_TYPES.has(value.type)) {
    throw new HttpError(400, 'contentJson contains an unsupported document node.');
  }
  counter.value += 1;
  if (counter.value > MAX_DOCUMENT_JSON_NODES || depth > MAX_DOCUMENT_JSON_DEPTH) {
    throw new HttpError(400, 'contentJson is too deeply nested or contains too many nodes.');
  }
  if (value.type === 'text' && typeof value.text !== 'string') {
    throw new HttpError(400, 'A contentJson text node must contain text.');
  }
  assertDocumentNodeAttributes(value);
  if ('content' in value) {
    if (!Array.isArray(value.content)) {
      throw new HttpError(400, 'contentJson node content must be an array.');
    }
    for (const child of value.content) assertDocumentJsonNode(child, depth + 1, counter);
  }
  if ('marks' in value) {
    if (!Array.isArray(value.marks)) {
      throw new HttpError(400, 'contentJson node marks must be an array.');
    }
    for (const mark of value.marks) {
      if (!isRecord(mark) || typeof mark.type !== 'string' || !DOCUMENT_MARK_TYPES.has(mark.type)) {
        throw new HttpError(400, 'contentJson contains an unsupported document mark.');
      }
      assertDocumentMarkAttributes(mark);
    }
  }
}

export function assertValidDocumentContentJson(
  value: Record<string, unknown> | null | undefined,
): void {
  if (value == null) return;
  if (!isRecord(value) || value.type !== 'doc') {
    throw new HttpError(400, 'contentJson must be a Tiptap document object.');
  }
  assertJsonByteSize(value, MAX_DOCUMENT_JSON_BYTES, 'contentJson');
  assertDocumentJsonNode(value, 0, { value: 0 });
}

function assertValidMetadata(value: Record<string, unknown> | undefined): void {
  if (value === undefined) return;
  if (!isRecord(value)) throw new HttpError(400, 'metadata must be an object.');
  assertJsonByteSize(value, MAX_DOCUMENT_METADATA_BYTES, 'metadata');
}

export async function updateDocument(
  projectId: number,
  documentId: number,
  userId: string,
  input: {
    version: number;
    title?: string;
    content?: string;
    contentJson?: Record<string, unknown> | null;
    icon?: string | null;
    metadata?: Record<string, unknown>;
    fullWidth?: boolean;
    parentId?: number | null;
    position?: number;
    previousSiblingId?: number | null;
    nextSiblingId?: number | null;
  },
): Promise<DocumentRow | null> {
  assertValidDocumentContentJson(input.contentJson);
  assertValidMetadata(input.metadata);
  return db.transaction(async (tx) => {
    const anchoredMove = input.previousSiblingId !== undefined || input.nextSiblingId !== undefined;
    if (anchoredMove && (input.parentId === undefined || input.position === undefined)) {
      throw new HttpError(400, 'An anchored move requires parentId and position.');
    }
    if (input.position !== undefined && !Number.isFinite(input.position)) {
      throw new HttpError(400, 'Document position must be finite.');
    }
    const current = await selectDocument(tx, projectId, documentId, userId);
    if (!current) return null;
    await lockDocumentActors(tx, [userId, current.ownerUserId]);
    if (input.parentId !== undefined || input.position !== undefined) {
      await tx.execute(
        sql`select pg_advisory_xact_lock(${DOCUMENT_TREE_LOCK_NAMESPACE}, ${projectId})`,
      );
    }
    assertExpectedVersion(current, input.version);
    assertActive(current);
    assertUnlocked(current);
    if (input.parentId !== undefined) {
      await assertValidParent(tx, projectId, documentId, input.parentId, userId);
    }
    const movePlan = anchoredMove
      ? await planDocumentMove(
          tx,
          projectId,
          documentId,
          input.parentId!,
          input.previousSiblingId ?? null,
          input.nextSiblingId ?? null,
        )
      : null;
    const [row] = await tx
      .update(projectDocument)
      .set({
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.content !== undefined ? { content: input.content } : {}),
        ...(input.contentJson !== undefined ? { contentJson: input.contentJson } : {}),
        ...(input.icon !== undefined ? { icon: input.icon } : {}),
        ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
        ...(input.fullWidth !== undefined ? { fullWidth: input.fullWidth } : {}),
        ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
        ...(input.position !== undefined ? { position: movePlan?.position ?? input.position } : {}),
        updatedByUserId: userId,
        updatedAt: sql`now()`,
        version: sql`${projectDocument.version} + 1`,
      })
      .where(
        and(
          eq(projectDocument.id, documentId),
          eq(projectDocument.projectId, projectId),
          eq(projectDocument.version, input.version),
        ),
      )
      .returning();
    if (!row) {
      throw new HttpError(409, 'This document changed elsewhere. Reload it before continuing.');
    }
    if (movePlan) {
      // Position normalization is implementation detail, not user-visible page
      // history. The Docs sync trigger still fires so every client refetches the
      // normalized sibling order, while sibling versions remain stable.
      const normalized = movePlan.siblingPositions.filter((sibling) => sibling.id !== documentId);
      if (normalized.length > 0) {
        await tx.execute(sql`select set_config('app.document_rebalance', 'true', true)`);
        const cases = sql.join(
          normalized.map(
            (sibling) => sql`when ${sibling.id} then ${sibling.position}::double precision`,
          ),
          sql` `,
        );
        await tx
          .update(projectDocument)
          .set({
            position: sql`case ${projectDocument.id} ${cases} else ${projectDocument.position} end`,
          })
          .where(
            and(
              eq(projectDocument.projectId, projectId),
              inArray(
                projectDocument.id,
                normalized.map((sibling) => sibling.id),
              ),
            ),
          );
      }
    }
    return mapDocumentForUser(tx, row, userId);
  });
}

async function ownedDocument(
  executor: Executor,
  projectId: number,
  documentId: number,
  userId: string,
  isProjectOwner: boolean,
) {
  const current = await selectDocument(executor, projectId, documentId, userId);
  if (!current) return null;
  if (current.ownerUserId !== userId && !(isProjectOwner && !current.isPrivate)) {
    throw new HttpError(403, 'Only the document owner can change this setting.');
  }
  return current;
}

export async function setDocumentAccess(
  projectId: number,
  documentId: number,
  userId: string,
  version: number,
  isPrivate: boolean,
): Promise<DocumentRow | null> {
  return db.transaction(async (tx) => {
    // Lock the owner before the page can become private. Account deletion then
    // either sees and removes the committed private row, or finishes first and
    // this request stops without creating an ownerless private page.
    const visible = await selectDocument(tx, projectId, documentId, userId);
    if (!visible) return null;
    await lockDocumentActors(tx, [userId, visible.ownerUserId]);
    const current = await ownedDocument(tx, projectId, documentId, userId, false);
    if (!current) return null;
    assertExpectedVersion(current, version);
    assertActive(current);
    if (current.isPrivate === isPrivate) return mapDocumentForUser(tx, current, userId);
    const [row] = await tx
      .update(projectDocument)
      .set({
        isPrivate,
        updatedByUserId: userId,
        updatedAt: sql`now()`,
        version: sql`${projectDocument.version} + 1`,
      })
      .where(and(eq(projectDocument.id, documentId), eq(projectDocument.version, version)))
      .returning();
    if (!row) {
      throw new HttpError(409, 'This document changed elsewhere. Reload it before continuing.');
    }
    return mapDocumentForUser(tx, row, userId);
  });
}

export async function transferDocumentOwnership(
  projectId: number,
  documentId: number,
  userId: string,
  version: number,
  ownerUserId: string,
  isProjectOwner: boolean,
): Promise<DocumentRow | null> {
  return db.transaction(async (tx) => {
    const visible = await selectDocument(tx, projectId, documentId, userId);
    if (!visible) return null;
    await lockDocumentActors(tx, [userId, visible.ownerUserId, ownerUserId]);
    const current = await ownedDocument(tx, projectId, documentId, userId, isProjectOwner);
    if (!current) return null;
    assertExpectedVersion(current, version);
    const [target] = await tx
      .select({ userId: projectMember.userId })
      .from(projectMember)
      .where(and(eq(projectMember.projectId, projectId), eq(projectMember.userId, ownerUserId)));
    if (!target) throw new HttpError(400, 'The new document owner must belong to this project.');
    if (current.ownerUserId === ownerUserId) return mapDocumentForUser(tx, current, userId);
    const [row] = await tx
      .update(projectDocument)
      .set({
        ownerUserId,
        updatedByUserId: userId,
        updatedAt: sql`now()`,
        version: sql`${projectDocument.version} + 1`,
      })
      .where(and(eq(projectDocument.id, documentId), eq(projectDocument.version, version)))
      .returning();
    if (!row) {
      throw new HttpError(409, 'This document changed elsewhere. Reload it before continuing.');
    }
    return mapDocumentForUser(tx, row, userId);
  });
}

export async function setDocumentLocked(
  projectId: number,
  documentId: number,
  userId: string,
  version: number,
  isLocked: boolean,
  isProjectOwner: boolean,
): Promise<DocumentRow | null> {
  return db.transaction(async (tx) => {
    const visible = await selectDocument(tx, projectId, documentId, userId);
    if (!visible) return null;
    await lockDocumentActors(tx, [userId, visible.ownerUserId]);
    const current = await ownedDocument(tx, projectId, documentId, userId, isProjectOwner);
    if (!current) return null;
    assertExpectedVersion(current, version);
    assertActive(current);
    if (current.isLocked === isLocked) return mapDocumentForUser(tx, current, userId);
    const [row] = await tx
      .update(projectDocument)
      .set({
        isLocked,
        updatedByUserId: userId,
        updatedAt: sql`now()`,
        version: sql`${projectDocument.version} + 1`,
      })
      .where(and(eq(projectDocument.id, documentId), eq(projectDocument.version, version)))
      .returning();
    if (!row) {
      throw new HttpError(409, 'This document changed elsewhere. Reload it before continuing.');
    }
    return mapDocumentForUser(tx, row, userId);
  });
}

async function documentSubtreeIds(
  executor: Executor,
  projectId: number,
  documentId: number,
  userId: string,
): Promise<number[]> {
  const rows = await executor
    .select({ id: projectDocument.id, parentId: projectDocument.parentId })
    .from(projectDocument)
    .where(and(eq(projectDocument.projectId, projectId), documentAccess(userId)));
  const ids = new Set<number>([documentId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const row of rows) {
      if (row.parentId !== null && ids.has(row.parentId) && !ids.has(row.id)) {
        ids.add(row.id);
        changed = true;
      }
    }
  }
  return [...ids];
}

export async function archiveDocument(
  projectId: number,
  documentId: number,
  userId: string,
  version: number,
  isProjectOwner: boolean,
): Promise<DocumentRow | null> {
  return db.transaction(async (tx) => {
    await lockProjectDocumentActors(tx, projectId, userId);
    await tx.execute(
      sql`select pg_advisory_xact_lock(${DOCUMENT_TREE_LOCK_NAMESPACE}, ${projectId})`,
    );
    await tx.execute(
      sql`select 1 from ${projectDocument} where ${projectDocument.id} = ${documentId} and ${projectDocument.projectId} = ${projectId} for update`,
    );
    const current = await ownedDocument(tx, projectId, documentId, userId, isProjectOwner);
    if (!current) return null;
    assertExpectedVersion(current, version);
    assertActive(current);
    assertUnlocked(current);
    const ids = await documentSubtreeIds(tx, projectId, documentId, userId);
    const [row] = await tx
      .update(projectDocument)
      .set({
        archivedAt: sql`now()`,
        archivedByAncestorId: null,
        updatedByUserId: userId,
        updatedAt: sql`now()`,
        version: sql`${projectDocument.version} + 1`,
      })
      .where(
        and(
          eq(projectDocument.id, documentId),
          eq(projectDocument.version, version),
          isNull(projectDocument.archivedAt),
        ),
      )
      .returning();
    if (!row) {
      throw new HttpError(409, 'This document changed elsewhere. Reload it before continuing.');
    }
    const descendantIds = ids.filter((id) => id !== documentId);
    if (descendantIds.length > 0) {
      await tx
        .update(projectDocument)
        .set({
          archivedAt: sql`now()`,
          archivedByAncestorId: documentId,
          updatedByUserId: userId,
          updatedAt: sql`now()`,
          version: sql`${projectDocument.version} + 1`,
        })
        .where(and(inArray(projectDocument.id, descendantIds), isNull(projectDocument.archivedAt)));
    }
    return mapDocumentForUser(tx, row, userId);
  });
}

export async function restoreDocument(
  projectId: number,
  documentId: number,
  userId: string,
  version: number,
  isProjectOwner: boolean,
): Promise<DocumentRow | null> {
  return db.transaction(async (tx) => {
    await lockProjectDocumentActors(tx, projectId, userId);
    await tx.execute(
      sql`select pg_advisory_xact_lock(${DOCUMENT_TREE_LOCK_NAMESPACE}, ${projectId})`,
    );
    await tx.execute(
      sql`select 1 from ${projectDocument} where ${projectDocument.id} = ${documentId} and ${projectDocument.projectId} = ${projectId} for update`,
    );
    const current = await ownedDocument(tx, projectId, documentId, userId, isProjectOwner);
    if (!current) return null;
    assertExpectedVersion(current, version);
    if (current.archivedAt === null) {
      throw new HttpError(409, 'This document is not archived.');
    }
    const archiveBatchId = current.archivedByAncestorId ?? documentId;
    const ids = await documentSubtreeIds(tx, projectId, documentId, userId);
    let detachFromParent = false;
    if (current.parentId !== null) {
      const [parent] = await tx
        .select({ archivedAt: projectDocument.archivedAt })
        .from(projectDocument)
        .where(and(eq(projectDocument.id, current.parentId), documentAccess(userId)));
      detachFromParent = !parent || parent.archivedAt !== null;
    }
    const [row] = await tx
      .update(projectDocument)
      .set({
        archivedAt: null,
        archivedByAncestorId: null,
        ...(detachFromParent ? { parentId: null } : {}),
        updatedByUserId: userId,
        updatedAt: sql`now()`,
        version: sql`${projectDocument.version} + 1`,
      })
      .where(
        and(
          eq(projectDocument.id, documentId),
          eq(projectDocument.version, version),
          isNotNull(projectDocument.archivedAt),
        ),
      )
      .returning();
    if (!row) {
      throw new HttpError(409, 'This document changed elsewhere. Reload it before continuing.');
    }
    const descendantIds = ids.filter((id) => id !== documentId);
    if (descendantIds.length > 0) {
      await tx
        .update(projectDocument)
        .set({
          archivedAt: null,
          archivedByAncestorId: null,
          updatedByUserId: userId,
          updatedAt: sql`now()`,
          version: sql`${projectDocument.version} + 1`,
        })
        .where(
          and(
            inArray(projectDocument.id, descendantIds),
            eq(projectDocument.archivedByAncestorId, archiveBatchId),
            isNotNull(projectDocument.archivedAt),
          ),
        );
    }
    return mapDocumentForUser(tx, row, userId);
  });
}

export async function duplicateDocument(input: {
  projectId: number;
  documentId: number;
  userId: string;
  version: number;
  title?: string;
  parentId?: number | null;
}): Promise<DocumentRow | null> {
  const copiedObjectKeys: string[] = [];
  try {
    return await db.transaction(async (tx) => {
      await lockAttachmentStorage(tx, input.projectId);
      await lockDocumentActor(tx, input.userId);
      await tx.execute(
        sql`select pg_advisory_xact_lock(${DOCUMENT_TREE_LOCK_NAMESPACE}, ${input.projectId})`,
      );
      await tx.execute(
        sql`select 1 from ${projectDocument} where ${projectDocument.id} = ${input.documentId} and ${projectDocument.projectId} = ${input.projectId} for share`,
      );
      const source = await selectDocument(tx, input.projectId, input.documentId, input.userId);
      if (!source) return null;
      assertExpectedVersion(source, input.version);
      assertValidDocumentContentJson(source.contentJson);
      const parentId =
        input.parentId === undefined
          ? await usableRevisionParent(tx, input.projectId, null, source.parentId, input.userId)
          : input.parentId;
      if (input.parentId !== undefined) {
        await assertValidParent(tx, input.projectId, null, parentId, input.userId);
      }
      const [row] = await tx
        .insert(projectDocument)
        .values({
          projectId: input.projectId,
          parentId,
          title: input.title ?? `${source.title || 'Untitled'} (Copy)`,
          content: source.content,
          contentJson: source.contentJson,
          icon: source.icon,
          metadata: source.metadata,
          fullWidth: source.fullWidth,
          isPrivate: source.isPrivate,
          position: await nextPosition(tx, input.projectId, parentId),
          ownerUserId: input.userId,
          createdByUserId: input.userId,
          updatedByUserId: input.userId,
        })
        .returning();
      const assets = await tx
        .select()
        .from(documentAsset)
        .where(eq(documentAsset.documentId, source.id));
      await assertAttachmentStorageCapacity(
        input.projectId,
        assets.reduce((total, asset) => total + asset.sizeBytes, 0),
        0,
        tx,
      );
      for (const asset of assets) {
        await assertAttachmentFileAllowed(asset.sizeBytes, asset.contentType);
      }
      const [projectRow] = await tx
        .select({ key: project.key })
        .from(project)
        .where(eq(project.id, input.projectId));
      const publicIds = new Map<string, string>();
      for (const asset of assets) {
        const key = attachmentObjectKey(input.projectId, 'documents', row.id, asset.filename);
        await cloneAttachmentObject(asset.s3Key, key, asset.contentType);
        copiedObjectKeys.push(key);
        const [copy] = await tx
          .insert(documentAsset)
          .values({
            documentId: row.id,
            uploadedByUserId: input.userId,
            s3Key: key,
            filename: asset.filename,
            contentType: asset.contentType,
            sizeBytes: asset.sizeBytes,
          })
          .returning({ publicId: documentAsset.publicId });
        publicIds.set(asset.publicId.toLowerCase(), copy.publicId);
      }
      if (publicIds.size > 0 && projectRow) {
        const [rewritten] = await tx
          .update(projectDocument)
          .set({
            content: replaceAssetReferences(
              row.content,
              source.id,
              projectRow.key,
              row.id,
              publicIds,
            ),
            contentJson: replaceAssetReferences(
              row.contentJson,
              source.id,
              projectRow.key,
              row.id,
              publicIds,
            ),
          })
          .where(eq(projectDocument.id, row.id))
          .returning();
        return mapDocumentForUser(tx, rewritten, input.userId);
      }
      return mapDocumentForUser(tx, row, input.userId);
    });
  } catch (error) {
    await Promise.all(copiedObjectKeys.map(deleteAttachmentObject));
    throw error;
  }
}

export async function setDocumentPreference(
  projectId: number,
  documentId: number,
  userId: string,
  isFavorite: boolean,
): Promise<{ isFavorite: boolean } | null> {
  if (!(await selectDocument(db, projectId, documentId, userId))) return null;
  await db
    .insert(projectDocumentPreference)
    .values({ documentId, userId, isFavorite, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [projectDocumentPreference.documentId, projectDocumentPreference.userId],
      set: { isFavorite, updatedAt: new Date() },
    });
  return { isFavorite };
}

export async function listDocumentRevisions(
  projectId: number,
  documentId: number,
  userId: string,
): Promise<DocumentRevisionSummaryRow[] | null> {
  const current = await selectDocument(db, projectId, documentId, userId);
  if (!current) return null;
  const rows = await db
    .select()
    .from(projectDocumentRevision)
    .where(
      and(
        eq(projectDocumentRevision.documentId, documentId),
        or(
          eq(projectDocumentRevision.isPrivate, false),
          eq(projectDocumentRevision.ownerUserId, userId),
        ),
      ),
    )
    .orderBy(desc(projectDocumentRevision.version));
  return rows.map(revisionSummaryOf);
}

export async function getDocumentRevision(
  projectId: number,
  documentId: number,
  revisionId: number,
  userId: string,
): Promise<DocumentRevisionRow | null> {
  const current = await selectDocument(db, projectId, documentId, userId);
  if (!current) return null;
  const [row] = await db
    .select()
    .from(projectDocumentRevision)
    .where(
      and(
        eq(projectDocumentRevision.id, revisionId),
        eq(projectDocumentRevision.documentId, documentId),
        or(
          eq(projectDocumentRevision.isPrivate, false),
          eq(projectDocumentRevision.ownerUserId, userId),
        ),
      ),
    );
  if (!row) return null;
  const parentId = await visibleDocumentParentId(db, projectId, row.parentId, userId);
  return mapRevision({ ...row, parentId });
}

async function usableRevisionParent(
  executor: Executor,
  projectId: number,
  documentId: number | null,
  parentId: number | null,
  userId: string,
): Promise<number | null> {
  if (parentId === null) return null;
  try {
    await assertValidParent(executor, projectId, documentId, parentId, userId);
    return parentId;
  } catch (error) {
    if (error instanceof HttpError && error.status === 400) return null;
    throw error;
  }
}

export async function restoreDocumentRevision(
  projectId: number,
  documentId: number,
  revisionId: number,
  userId: string,
  version: number,
): Promise<DocumentRow | null> {
  return db.transaction(async (tx) => {
    const visible = await selectDocument(tx, projectId, documentId, userId);
    if (!visible) return null;
    await lockDocumentActors(tx, [userId, visible.ownerUserId]);
    await tx.execute(sql`select set_config('app.document_checkpoint', 'true', true)`);
    await tx.execute(
      sql`select pg_advisory_xact_lock(${DOCUMENT_TREE_LOCK_NAMESPACE}, ${projectId})`,
    );
    const current = await selectDocument(tx, projectId, documentId, userId);
    if (!current) return null;
    assertExpectedVersion(current, version);
    assertActive(current);
    assertUnlocked(current);
    const [revision] = await tx
      .select()
      .from(projectDocumentRevision)
      .where(
        and(
          eq(projectDocumentRevision.id, revisionId),
          eq(projectDocumentRevision.documentId, documentId),
          or(
            eq(projectDocumentRevision.isPrivate, false),
            eq(projectDocumentRevision.ownerUserId, userId),
          ),
        ),
      );
    if (!revision) throw new HttpError(404, 'Document revision not found');
    if (revision.isPrivate && (revision.ownerUserId !== userId || current.ownerUserId !== userId)) {
      throw new HttpError(403, 'Only the current document owner can restore a private revision.');
    }
    assertValidDocumentContentJson(revision.contentJson);
    const parentId = await usableRevisionParent(
      tx,
      projectId,
      documentId,
      revision.parentId,
      userId,
    );
    const [row] = await tx
      .update(projectDocument)
      .set({
        parentId,
        title: revision.title,
        content: revision.content,
        contentJson: revision.contentJson,
        icon: revision.icon,
        metadata: revision.metadata,
        fullWidth: revision.fullWidth,
        position: revision.position,
        // A historical secret may never be restored into a public current row.
        // Restoring a public snapshot into a private page keeps the safer current
        // access level instead of unexpectedly publishing it.
        ...(revision.isPrivate ? { isPrivate: true } : {}),
        updatedByUserId: userId,
        updatedAt: sql`now()`,
        version: sql`${projectDocument.version} + 1`,
      })
      .where(and(eq(projectDocument.id, documentId), eq(projectDocument.version, version)))
      .returning();
    if (!row) {
      throw new HttpError(409, 'This document changed elsewhere. Reload it before continuing.');
    }
    return mapDocumentForUser(tx, row, userId);
  });
}

export async function exportDocument(
  projectId: number,
  documentId: number,
  userId: string,
): Promise<{
  filename: string;
  mimeType: 'text/markdown';
  content: string;
  version: number;
  exportedAt: string;
} | null> {
  const document = await getDocument(projectId, documentId, userId);
  if (!document) return null;
  const printableTitle = [...document.title.trim()]
    .map((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127 ? '-' : character;
    })
    .join('');
  const stem = printableTitle.replace(/[<>:"/\\|?*]/g, '-').slice(0, 120) || 'untitled';
  return {
    filename: `${stem}.md`,
    mimeType: 'text/markdown',
    content: document.content,
    version: document.version,
    exportedAt: iso(new Date()),
  };
}

export async function deleteDocument(
  projectId: number,
  documentId: number,
  userId: string,
  version: number,
  isProjectOwner: boolean,
): Promise<string[] | null> {
  return db.transaction(async (tx) => {
    await lockAttachmentStorage(tx, projectId);
    await lockProjectDocumentActors(tx, projectId, userId);
    await tx.execute(
      sql`select pg_advisory_xact_lock(${DOCUMENT_TREE_LOCK_NAMESPACE}, ${projectId})`,
    );
    const current = await ownedDocument(tx, projectId, documentId, userId, isProjectOwner);
    if (!current) return null;
    assertExpectedVersion(current, version);
    assertUnlocked(current);
    if (current.archivedAt === null) {
      throw new HttpError(409, 'Archive this document before deleting it.');
    }
    await tx
      .update(projectDocument)
      .set({
        parentId: null,
        updatedByUserId: userId,
        updatedAt: sql`now()`,
        version: sql`${projectDocument.version} + 1`,
      })
      .where(
        and(eq(projectDocument.projectId, projectId), eq(projectDocument.parentId, documentId)),
      );
    const assets = await tx
      .select({ s3Key: documentAsset.s3Key })
      .from(documentAsset)
      .where(eq(documentAsset.documentId, documentId));
    const rows = await tx
      .delete(projectDocument)
      .where(
        and(
          eq(projectDocument.id, documentId),
          eq(projectDocument.projectId, projectId),
          eq(projectDocument.version, version),
        ),
      )
      .returning({ id: projectDocument.id });
    if (rows.length > 0) return assets.map((asset) => asset.s3Key);
    throw new HttpError(409, 'This document changed elsewhere. Reload it before deleting.');
  });
}
