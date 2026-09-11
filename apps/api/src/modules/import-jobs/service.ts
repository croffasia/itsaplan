import { db, importJob, importRecord } from '@repo/db';
import { desc, eq, sql } from 'drizzle-orm';
import { encryptSecret } from '@repo/crypto';
import { HttpError, iso } from '#shared/lib';
import { pinnedFetch } from '#shared/net';

// Data access and the Plane connection check for import jobs. Creating a job only
// encrypts and stores the submitted credential and leaves the row 'pending' for the
// worker (apps/worker/src/import-worker.ts) to pick up and drive through its phases —
// this module never talks to the worker or reads the credential back. Progress is
// read from import_record, the worker's own source-id-to-local-id mapping table.

// Mirrors import_record_source_entity_type_check in packages/db/src/schema/app.ts.
export const IMPORT_ENTITY_TYPES = [
  'issue',
  'comment',
  'label',
  'state',
  'cycle',
  'attachment',
] as const;
export type ImportEntityType = (typeof IMPORT_ENTITY_TYPES)[number];

export type ImportJobPhase = 'discover' | 'create' | 'link' | 'attachments' | 'done';
export type ImportJobStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed';
export type UnmatchedUserPolicy = 'unassigned' | 'skip';
type StateCategory = 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled';

interface EntityCount {
  discovered: number;
  created: number;
}

export interface ImportJobDto {
  id: number;
  projectId: number;
  source: 'plane';
  phase: ImportJobPhase;
  status: ImportJobStatus;
  counts: Record<ImportEntityType, EntityCount>;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

type ImportJobRow = typeof importJob.$inferSelect;

async function entityCounts(jobId: number): Promise<Record<ImportEntityType, EntityCount>> {
  const rows = await db
    .select({
      entityType: importRecord.sourceEntityType,
      discovered: sql<number>`count(*)::int`,
      created: sql<number>`count(${importRecord.localId})::int`,
    })
    .from(importRecord)
    .where(eq(importRecord.importJobId, jobId))
    .groupBy(importRecord.sourceEntityType);
  const counts = Object.fromEntries(
    IMPORT_ENTITY_TYPES.map((type) => [type, { discovered: 0, created: 0 }]),
  ) as Record<ImportEntityType, EntityCount>;
  for (const row of rows) {
    counts[row.entityType as ImportEntityType] = {
      discovered: row.discovered,
      created: row.created,
    };
  }
  return counts;
}

function toDto(row: ImportJobRow, counts: Record<ImportEntityType, EntityCount>): ImportJobDto {
  return {
    id: row.id,
    projectId: row.projectId,
    source: row.source as 'plane',
    phase: row.phase as ImportJobPhase,
    status: row.status as ImportJobStatus,
    counts,
    lastError: row.lastError,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

async function getRow(id: number): Promise<ImportJobRow | null> {
  const rows = await db.select().from(importJob).where(eq(importJob.id, id));
  return rows[0] ?? null;
}

export async function getImportJobProjectId(id: number): Promise<number | null> {
  const rows = await db
    .select({ projectId: importJob.projectId })
    .from(importJob)
    .where(eq(importJob.id, id));
  return rows[0]?.projectId ?? null;
}

export async function getImportJobDto(id: number): Promise<ImportJobDto | null> {
  const row = await getRow(id);
  return row ? toDto(row, await entityCounts(id)) : null;
}

// Not paged: a project accumulates at most a handful of import jobs, never a list
// long enough to need it (see apps/api/AGENTS.md's paged-vs-whole-list rule).
export async function listImportJobs(projectId: number): Promise<ImportJobDto[]> {
  const rows = await db
    .select()
    .from(importJob)
    .where(eq(importJob.projectId, projectId))
    .orderBy(desc(importJob.createdAt));
  return Promise.all(rows.map(async (row) => toDto(row, await entityCounts(row.id))));
}

// Normalizes and validates a base URL without resolving it — the worker's own
// pinnedFetch call (apps/worker/src/plane-adapter.ts) is what enforces the SSRF
// guards against the address actually used, on every request it makes.
function normalizePlaneBaseUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new HttpError(400, 'baseUrl must be a valid URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new HttpError(400, 'baseUrl must be a valid URL');
  }
  return url.origin;
}

export interface CreateImportJobInput {
  baseUrl: string;
  workspaceSlug: string;
  apiToken: string;
  planeProjectId: string;
  unmatchedUserPolicy?: UnmatchedUserPolicy;
  stateOverrides?: Record<string, StateCategory>;
}

// Stores the submitted credential encrypted and leaves the job 'pending' — the
// worker picks it up on its next poll. The plaintext token exists only in this
// function's local variables; it is never persisted or logged.
export async function createImportJob(
  projectId: number,
  actorUserId: string,
  input: CreateImportJobInput,
): Promise<ImportJobDto> {
  const baseUrl = normalizePlaneBaseUrl(input.baseUrl);
  const workspaceSlug = input.workspaceSlug.trim();
  const apiToken = input.apiToken.trim();
  const planeProjectId = input.planeProjectId.trim();
  if (!workspaceSlug) throw new HttpError(400, 'workspaceSlug is required');
  if (!apiToken) throw new HttpError(400, 'apiToken is required');
  if (!planeProjectId) throw new HttpError(400, 'planeProjectId is required');

  const encrypted = encryptSecret(JSON.stringify({ baseUrl, workspaceSlug, apiKey: apiToken }));
  const config = {
    planeProjectId,
    unmatchedUserPolicy: input.unmatchedUserPolicy ?? 'unassigned',
    ...(input.stateOverrides && Object.keys(input.stateOverrides).length > 0
      ? { stateOverrides: input.stateOverrides }
      : {}),
  };
  const [row] = await db
    .insert(importJob)
    .values({
      projectId,
      createdByUserId: actorUserId,
      source: 'plane',
      config,
      credentialCiphertext: encrypted.ciphertext,
      credentialIv: encrypted.iv,
      credentialAuthTag: encrypted.authTag,
    })
    .returning();
  return toDto(row!, await entityCounts(row!.id));
}

// Only import_job.status values the worker's claim query (status = 'pending') will
// ever pick up are eligible to pause; a job the worker has already finished cannot.
export async function pauseImportJob(id: number): Promise<ImportJobDto> {
  const row = await getRow(id);
  if (!row) throw new HttpError(404, 'Import job not found');
  if (row.status !== 'pending' && row.status !== 'running') {
    throw new HttpError(409, `Cannot pause a job that is ${row.status}`);
  }
  const [updated] = await db
    .update(importJob)
    .set({ status: 'paused', updatedAt: new Date() })
    .where(eq(importJob.id, id))
    .returning();
  return toDto(updated!, await entityCounts(id));
}

// Resets attempts and next_attempt_at so the job is immediately claimable again,
// the same starting state a freshly created job has.
export async function resumeImportJob(id: number): Promise<ImportJobDto> {
  const row = await getRow(id);
  if (!row) throw new HttpError(404, 'Import job not found');
  if (row.status !== 'paused')
    throw new HttpError(409, `Cannot resume a job that is ${row.status}`);
  const [updated] = await db
    .update(importJob)
    .set({ status: 'pending', attempts: 0, nextAttemptAt: new Date(), updatedAt: new Date() })
    .where(eq(importJob.id, id))
    .returning();
  return toDto(updated!, await entityCounts(id));
}

// import_job_status_check has no 'canceled' value, so a cancel lands on 'failed' —
// the terminal status the worker already treats as done, clearing the credential
// the same way completeImportJob/failImportJob do.
export async function cancelImportJob(id: number): Promise<ImportJobDto> {
  const row = await getRow(id);
  if (!row) throw new HttpError(404, 'Import job not found');
  if (row.status === 'completed' || row.status === 'failed') {
    throw new HttpError(409, `Cannot cancel a job that is already ${row.status}`);
  }
  const [updated] = await db
    .update(importJob)
    .set({
      status: 'failed',
      lastError: 'Canceled',
      credentialCiphertext: null,
      credentialIv: null,
      credentialAuthTag: null,
      updatedAt: new Date(),
    })
    .where(eq(importJob.id, id))
    .returning();
  return toDto(updated!, await entityCounts(id));
}

export interface PlaneProjectOption {
  id: string;
  name: string;
  identifier: string;
}

interface PlaneProjectListEnvelope {
  results?: { id: string; name: string; identifier: string }[];
}

// Confirms a submitted token can reach the workspace before it is ever encrypted
// or stored, with the single lightweight call docs/dev/plane-import-source-notes.md
// confirms live: GET /workspaces/{slug}/projects/. The returned projects are what a
// create form offers as candidates for planeProjectId.
export async function testPlaneConnection(
  baseUrl: string,
  workspaceSlug: string,
  apiToken: string,
): Promise<{ projects: PlaneProjectOption[] }> {
  const url = normalizePlaneBaseUrl(baseUrl);
  const slug = workspaceSlug.trim();
  const token = apiToken.trim();
  if (!slug) throw new HttpError(400, 'workspaceSlug is required');
  if (!token) throw new HttpError(400, 'apiToken is required');

  let response: Response;
  try {
    response = await pinnedFetch(`${url}/api/v1/workspaces/${slug}/projects/`, {
      headers: { 'X-Api-Key': token },
      timeoutMs: 15_000,
    });
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(502, 'The Plane instance could not be reached.');
  }
  if (response.status === 401 || response.status === 403) {
    throw new HttpError(400, 'Plane rejected the API token.');
  }
  if (!response.ok) {
    throw new HttpError(502, `Plane request failed with status ${response.status}.`);
  }
  const body = (await response.json()) as PlaneProjectListEnvelope;
  return {
    projects: (body.results ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      identifier: p.identifier,
    })),
  };
}
