import { HttpError } from '#shared/lib';
import { pinnedFetch } from '#shared/net';

// The Procore side of import jobs: checking a Developer Managed Service Account,
// listing the company's projects, previewing a tool's states, and validating a job's
// Procore fields. Procore's hosts are fixed. The worker's reader is
// apps/worker/src/procore-adapter.ts; the small state tables are repeated here.

type StateCategory = 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled';
export type ProcoreFetch = typeof pinnedFetch;
export type ProcoreTool = 'punch_items' | 'rfis';

export interface ProcoreConnectionInput {
  clientId: string;
  clientSecret: string;
  companyId: string;
  sandbox?: boolean;
}

export interface CreateProcoreImportJobInput extends ProcoreConnectionInput {
  source: 'procore';
  procoreProjectId: string;
  procoreTool: ProcoreTool;
}

const PAGE_SIZE = 100;
const MAX_PAGES = 50;

const STATES: Record<ProcoreTool, [string, StateCategory][]> = {
  punch_items: [
    ['Draft', 'backlog'],
    ['Initiated', 'unstarted'],
    ['Open', 'unstarted'],
    ['Work Required', 'unstarted'],
    ['In Progress', 'started'],
    ['Ready for Review', 'started'],
    ['Work Not Accepted', 'started'],
    ['Ready to Close', 'started'],
    ['Closed', 'completed'],
  ],
  rfis: [
    ['Draft', 'backlog'],
    ['Open', 'started'],
    ['Closed', 'completed'],
    ['Void', 'canceled'],
  ],
};

function hosts(sandbox: boolean | undefined) {
  return sandbox
    ? { api: 'https://sandbox.procore.com', login: 'https://login-sandbox.procore.com' }
    : { api: 'https://api.procore.com', login: 'https://login.procore.com' };
}

function connection(input: ProcoreConnectionInput): ProcoreConnectionInput {
  const clientId = input.clientId.trim();
  const clientSecret = input.clientSecret.trim();
  const companyId = input.companyId.trim();
  if (!clientId) throw new HttpError(400, 'clientId is required');
  if (!clientSecret) throw new HttpError(400, 'clientSecret is required');
  if (!/^\d+$/.test(companyId)) throw new HttpError(400, 'companyId must be a number');
  return { clientId, clientSecret, companyId, sandbox: input.sandbox === true };
}

function numericId(raw: string, field: string): string {
  const id = raw.trim();
  if (!/^\d+$/.test(id)) throw new HttpError(400, `${field} must be a number`);
  return id;
}

function tool(raw: string): ProcoreTool {
  if (raw !== 'punch_items' && raw !== 'rfis') {
    throw new HttpError(400, 'procoreTool must be punch_items or rfis');
  }
  return raw;
}

async function send(fetch: ProcoreFetch, url: string, init: Parameters<ProcoreFetch>[1]) {
  try {
    return await fetch(url, { ...init, timeoutMs: 15_000 });
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(502, 'Procore could not be reached.');
  }
}

async function accessToken(input: ProcoreConnectionInput, fetch: ProcoreFetch): Promise<string> {
  const response = await send(fetch, `${hosts(input.sandbox).login}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: input.clientId,
      client_secret: input.clientSecret,
    }).toString(),
  });
  if (response.status === 400 || response.status === 401) {
    throw new HttpError(400, 'Procore rejected the client ID or secret.');
  }
  if (response.status === 429) {
    throw new HttpError(502, "Procore's rate limit was reached. Try again in a few minutes.");
  }
  if (!response.ok) {
    throw new HttpError(502, `Procore request failed with status ${response.status}.`);
  }
  const body = (await response.json()) as { access_token?: string };
  if (!body.access_token) throw new HttpError(502, 'Procore returned no access token.');
  return body.access_token;
}

async function procoreGet<T>(
  input: ProcoreConnectionInput,
  token: string,
  path: string,
  fetch: ProcoreFetch,
): Promise<T> {
  const response = await send(fetch, `${hosts(input.sandbox).api}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Procore-Company-Id': input.companyId,
      Accept: 'application/json',
    },
  });
  if (response.status === 401 || response.status === 403) {
    throw new HttpError(400, 'The Procore service account cannot read this company or project.');
  }
  if (response.status === 404) throw new HttpError(400, 'Procore company or project not found.');
  if (response.status === 429) {
    throw new HttpError(502, "Procore's rate limit was reached. Try again in a few minutes.");
  }
  if (!response.ok) {
    throw new HttpError(502, `Procore request failed with status ${response.status}.`);
  }
  return (await response.json()) as T;
}

// The projects the service account was granted in this company.
export async function testProcoreConnection(
  raw: ProcoreConnectionInput,
  fetch: ProcoreFetch = pinnedFetch,
): Promise<{ projects: { id: string; name: string }[] }> {
  const input = connection(raw);
  const token = await accessToken(input, fetch);
  const projects: { id: number | string; name: string }[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const items = await procoreGet<{ id: number | string; name: string }[]>(
      input,
      token,
      `/rest/v1.0/projects?company_id=${input.companyId}&page=${page}&per_page=${PAGE_SIZE}`,
      fetch,
    );
    projects.push(...items);
    if (items.length < PAGE_SIZE) break;
  }
  return {
    projects: projects
      .map((p) => ({ id: String(p.id), name: p.name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

// Reads one item of the tool, so a project or tool the account cannot read fails here.
export async function previewProcoreStates(
  raw: ProcoreConnectionInput & { procoreProjectId: string; procoreTool: string },
  fetch: ProcoreFetch = pinnedFetch,
): Promise<{ states: { id: string; name: string; category: StateCategory }[] }> {
  const input = connection(raw);
  const projectId = numericId(raw.procoreProjectId, 'procoreProjectId');
  const procoreTool = tool(raw.procoreTool);
  const token = await accessToken(input, fetch);
  await procoreGet(
    input,
    token,
    procoreTool === 'rfis'
      ? `/rest/v1.0/projects/${projectId}/rfis?page=1&per_page=1`
      : `/rest/v1.0/punch_items?project_id=${projectId}&page=1&per_page=1`,
    fetch,
  );
  return {
    states: STATES[procoreTool].map(([name, category]) => ({
      id: name.toLowerCase().replace(/\s+/g, '-'),
      name,
      category,
    })),
  };
}

// What createImportJob stores for a Procore job; apps/worker/src/import-sources.ts reads it back.
export function procoreJobFields(input: CreateProcoreImportJobInput) {
  return {
    source: 'procore' as const,
    credential: connection(input),
    config: {
      procoreProjectId: numericId(input.procoreProjectId, 'procoreProjectId'),
      procoreTool: tool(input.procoreTool),
    },
  };
}
