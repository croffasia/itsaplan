import { HttpError } from '#shared/lib';
import { pinnedFetch } from '#shared/net';

// The Jira Cloud side of import jobs: checking an account email and API token
// against a site, listing its projects, previewing a project's statuses, and
// validating a job's Jira fields. The site must be https://<site>.atlassian.net,
// since the token is sent there. The worker's reader is
// apps/worker/src/jira-adapter.ts; the small state mapping is repeated here.

type StateCategory = 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled';
export type JiraFetch = typeof pinnedFetch;

export interface JiraConnectionInput {
  baseUrl: string;
  email: string;
  apiToken: string;
}

export interface CreateJiraImportJobInput extends JiraConnectionInput {
  source: 'jira';
  jiraProjectKey: string;
}

interface JiraStatus {
  id: string;
  name: string;
  statusCategory: { key: string };
}

const CATEGORY_MAP: Record<string, StateCategory> = {
  new: 'unstarted',
  indeterminate: 'started',
  done: 'completed',
};

function statusCategory(status: JiraStatus): StateCategory {
  if (/cancel|won'?t do|rejected/i.test(status.name)) return 'canceled';
  if (/backlog/i.test(status.name)) return 'backlog';
  return CATEGORY_MAP[status.statusCategory.key] ?? 'backlog';
}

export function normalizeJiraBaseUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new HttpError(400, 'baseUrl must be a valid URL');
  }
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.atlassian.net')) {
    throw new HttpError(400, 'baseUrl must be a Jira Cloud site (https://<site>.atlassian.net)');
  }
  return url.origin;
}

function connection(input: JiraConnectionInput): JiraConnectionInput {
  const email = input.email.trim();
  const apiToken = input.apiToken.trim();
  if (!email) throw new HttpError(400, 'email is required');
  if (!apiToken) throw new HttpError(400, 'apiToken is required');
  return { baseUrl: normalizeJiraBaseUrl(input.baseUrl), email, apiToken };
}

async function jiraGet<T>(input: JiraConnectionInput, path: string, fetch: JiraFetch): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${input.baseUrl}${path}`, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${input.email}:${input.apiToken}`).toString('base64')}`,
        Accept: 'application/json',
      },
      timeoutMs: 15_000,
    });
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(502, 'Jira could not be reached.');
  }
  if (response.status === 401 || response.status === 403) {
    throw new HttpError(400, 'Jira rejected the email or API token.');
  }
  if (response.status === 404) throw new HttpError(400, 'Jira project not found.');
  if (response.status === 429) {
    throw new HttpError(502, "Jira's rate limit was reached. Try again in a few minutes.");
  }
  if (!response.ok) throw new HttpError(502, `Jira request failed with status ${response.status}.`);
  return (await response.json()) as T;
}

// Confirms the credential works, then lists every project it can browse.
export async function testJiraConnection(
  raw: JiraConnectionInput,
  fetch: JiraFetch = pinnedFetch,
): Promise<{ projects: { id: string; key: string; name: string }[] }> {
  const input = connection(raw);
  await jiraGet(input, '/rest/api/3/myself', fetch);
  type Page = { values: { id: string; key: string; name: string }[]; isLast: boolean };
  const projects: Page['values'] = [];
  for (let startAt = 0; ;) {
    const page = await jiraGet<Page>(
      input,
      `/rest/api/3/project/search?maxResults=50&startAt=${startAt}`,
      fetch,
    );
    projects.push(...page.values);
    startAt += page.values.length;
    if (page.isLast || page.values.length === 0) break;
  }
  return {
    projects: projects
      .map((p) => ({ id: p.id, key: p.key, name: p.name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

// A project's statuses, each once (one status serves several issue types).
export async function previewJiraStates(
  raw: JiraConnectionInput & { jiraProjectKey: string },
  fetch: JiraFetch = pinnedFetch,
): Promise<{ states: { id: string; name: string; category: StateCategory }[] }> {
  const input = connection(raw);
  const key = projectKey(raw.jiraProjectKey);
  const types = await jiraGet<{ statuses: JiraStatus[] }[]>(
    input,
    `/rest/api/3/project/${encodeURIComponent(key)}/statuses`,
    fetch,
  );
  const seen = new Map<string, { id: string; name: string; category: StateCategory }>();
  for (const type of types) {
    for (const s of type.statuses) {
      if (!seen.has(s.id)) seen.set(s.id, { id: s.id, name: s.name, category: statusCategory(s) });
    }
  }
  return { states: [...seen.values()] };
}

function projectKey(raw: string): string {
  const key = raw.trim();
  if (!/^[A-Z][A-Z0-9_]*$/.test(key))
    throw new HttpError(400, 'jiraProjectKey is not a Jira project key');
  return key;
}

// What createImportJob stores for a Jira job; apps/worker/src/import-sources.ts reads it back.
export function jiraJobFields(input: CreateJiraImportJobInput) {
  return {
    source: 'jira' as const,
    credential: connection(input),
    config: { jiraProjectKey: projectKey(input.jiraProjectKey) },
  };
}
