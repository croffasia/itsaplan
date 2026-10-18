import { randomUUID } from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';
import { putObject } from '@repo/storage';
import { HttpError } from '#shared/lib';

// The MS Project side of import jobs: an uploaded MSPDI XML file is checked, counted
// and stored in the object store, and the job refers to it by key. The worker's
// reader is apps/worker/src/msproject-adapter.ts.

export const MSPROJECT_MAX_BYTES = 20 * 1024 * 1024;
const MSPDI_NAMESPACE = 'http://schemas.microsoft.com/project';
const SAVE_AS_XML = 'Save the plan as XML first: File > Save As > XML Format.';

const STATES = [
  { id: 'todo', name: 'Todo', category: 'unstarted' as const },
  { id: 'in-progress', name: 'In Progress', category: 'started' as const },
  { id: 'done', name: 'Done', category: 'completed' as const },
];

export interface CreateMsProjectImportJobInput {
  source: 'msproject';
  msprojectFileKey: string;
  msprojectName: string;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: false,
  removeNSPrefix: false,
  processEntities: true,
  htmlEntities: false,
  isArray: (name) => name === 'Task',
});

export function msprojectKeyPrefix(projectId: number): string {
  return `import-sources/${projectId}/`;
}

// Counts the tasks the worker will import: a named task other than the project summary (UID 0).
export function parseMsProjectFile(xml: string): { taskCount: number } {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) {
    throw new HttpError(400, 'The file declares a DOCTYPE, which is not supported.');
  }
  let root: Record<string, unknown> | undefined;
  try {
    root = (parser.parse(xml) as { Project?: Record<string, unknown> }).Project;
  } catch {
    throw new HttpError(400, 'The file is not valid XML.');
  }
  if (!root || typeof root !== 'object' || root['@_xmlns'] !== MSPDI_NAMESPACE) {
    throw new HttpError(400, `The file is not an MS Project XML (MSPDI) file. ${SAVE_AS_XML}`);
  }
  const tasks = (root.Tasks as { Task?: Record<string, unknown>[] } | undefined)?.Task ?? [];
  const taskCount = tasks.filter(
    (t) => String(t.UID ?? '').trim() !== '0' && String(t.Name ?? '').trim() !== '',
  ).length;
  return { taskCount };
}

export async function uploadMsProjectFile(projectId: number, file: File) {
  if (/\.mpp$/i.test(file.name))
    throw new HttpError(400, `.mpp files are not supported. ${SAVE_AS_XML}`);
  if (!/\.xml$/i.test(file.name)) throw new HttpError(400, `Upload an .xml file. ${SAVE_AS_XML}`);
  if (file.size > MSPROJECT_MAX_BYTES) {
    throw new HttpError(413, 'The file is larger than 20 MB.');
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  const { taskCount } = parseMsProjectFile(bytes.toString('utf8'));
  if (taskCount === 0) throw new HttpError(400, 'The plan has no tasks to import.');
  const fileKey = `${msprojectKeyPrefix(projectId)}${randomUUID()}.xml`;
  try {
    await putObject(fileKey, bytes, 'application/xml');
  } catch {
    throw new HttpError(502, 'The file could not be stored.');
  }
  return { fileKey, fileName: file.name, taskCount, states: STATES };
}

// What createImportJob stores for an MS Project job; apps/worker/src/import-sources.ts reads
// it back. The credential is an empty object because the pipeline requires one.
export function msprojectJobFields(projectId: number, input: CreateMsProjectImportJobInput) {
  const key = input.msprojectFileKey.trim();
  if (
    !key.startsWith(msprojectKeyPrefix(projectId)) ||
    !/^[\w./-]+\.xml$/.test(key) ||
    key.includes('..')
  ) {
    throw new HttpError(400, 'msprojectFileKey is not an uploaded file of this project');
  }
  return {
    source: 'msproject' as const,
    credential: {},
    config: { msprojectFileKey: key, msprojectName: input.msprojectName.trim() },
  };
}
