import { HttpError } from '#shared/lib';
import { pinnedFetch } from '#shared/net';

// The Linear side of import jobs: checking a personal API key, listing the teams
// and projects it can see, previewing a team's workflow states, and validating a
// job's Linear fields. Linear's endpoint is fixed, so no user-supplied URL is ever
// fetched; the key is sent as "Authorization: <key>" (no "Bearer"). The worker's
// own reader is apps/worker/src/linear-adapter.ts; the api does not depend on the
// worker, so the small state mapping below is repeated here, as Plane's is.

export const LINEAR_GRAPHQL_URL = 'https://api.linear.app/graphql';
const PAGE_SIZE = 50;

type StateCategory = 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled';
export type LinearFetch = typeof pinnedFetch;

export interface LinearProjectOption {
  id: string;
  name: string;
}

export interface LinearTeamOption {
  id: string;
  key: string;
  name: string;
  projects: LinearProjectOption[];
}

export interface LinearStateOption {
  id: string;
  name: string;
  category: StateCategory;
}

export interface CreateLinearImportJobInput {
  source: 'linear';
  apiToken: string;
  teamId: string;
  teamKey: string;
  projectFilter: 'project' | 'none';
  projectId?: string;
}

interface Connection<T> {
  nodes: T[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
}

interface GraphqlError {
  message: string;
  extensions?: { code?: string; userError?: boolean; userPresentableMessage?: string };
}

interface GraphqlResponse<D> {
  data?: D | null;
  errors?: GraphqlError[];
}

const TEAMS_QUERY = `query Teams($after: String) {
  connection: teams(first: ${PAGE_SIZE}, after: $after) {
    nodes { id key name }
    pageInfo { hasNextPage endCursor }
  }
}`;

const PROJECTS_QUERY = `query Projects($after: String) {
  connection: projects(first: ${PAGE_SIZE}, after: $after, includeArchived: true) {
    nodes { id name teams(first: ${PAGE_SIZE}) { nodes { id } } }
    pageInfo { hasNextPage endCursor }
  }
}`;

const STATES_QUERY = `query States($teamId: String!, $after: String) {
  team(id: $teamId) {
    connection: states(first: ${PAGE_SIZE}, after: $after, includeArchived: true) {
      nodes { id name type position }
      pageInfo { hasNextPage endCursor }
    }
  }
}`;

const USER_ERROR_CODES = new Set(['INVALID_INPUT', 'FORBIDDEN']);

const STATE_CATEGORY_MAP: Record<string, StateCategory> = {
  triage: 'backlog',
  backlog: 'backlog',
  unstarted: 'unstarted',
  started: 'started',
  completed: 'completed',
  canceled: 'canceled',
  duplicate: 'canceled',
};

async function linearQuery<D>(
  apiKey: string,
  query: string,
  variables: Record<string, unknown>,
  fetch: LinearFetch,
): Promise<D> {
  let response: Response;
  try {
    response = await fetch(LINEAR_GRAPHQL_URL, {
      method: 'POST',
      headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
      timeoutMs: 15_000,
    });
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(502, 'Linear could not be reached.');
  }
  const body = (await response.json().catch(() => ({}))) as GraphqlResponse<D>;
  const codes = (body.errors ?? []).map((e) => e.extensions?.code);
  if (response.status === 401 || codes.includes('AUTHENTICATION_ERROR')) {
    throw new HttpError(400, 'Linear rejected the API key.');
  }
  if (response.status === 429 || codes.includes('RATELIMITED')) {
    throw new HttpError(502, "Linear's rate limit was reached. Try again in a few minutes.");
  }
  // A wrong team id, or one the key cannot see: the caller's mistake, not Linear's.
  const userError = (body.errors ?? []).find(
    (e) => e.extensions?.userError || USER_ERROR_CODES.has(e.extensions?.code ?? ''),
  );
  if (userError) {
    const shown = userError.extensions?.userPresentableMessage ?? userError.message;
    throw new HttpError(400, `Linear refused the request: ${shown}`);
  }
  if (!response.ok || !body.data || codes.length > 0) {
    throw new HttpError(502, `Linear request failed with status ${response.status}.`);
  }
  return body.data;
}

async function linearPaginate<T, D>(
  apiKey: string,
  query: string,
  variables: Record<string, unknown>,
  connectionOf: (data: D) => Connection<T>,
  fetch: LinearFetch,
): Promise<T[]> {
  const all: T[] = [];
  let after: string | null = null;
  do {
    const data: D = await linearQuery<D>(apiKey, query, { ...variables, after }, fetch);
    const connection = connectionOf(data);
    all.push(...connection.nodes);
    after = connection.pageInfo.hasNextPage ? connection.pageInfo.endCursor : null;
  } while (after !== null);
  return all;
}

function requireKey(apiToken: string): string {
  const apiKey = apiToken.trim();
  if (!apiKey) throw new HttpError(400, 'apiToken is required');
  return apiKey;
}

// Confirms the key works before anything is stored, and returns every team it can
// see with that team's projects (archived ones included: an archive import wants
// them). A project shared by two teams is listed under both.
export async function testLinearConnection(
  apiToken: string,
  fetch: LinearFetch = pinnedFetch,
): Promise<{ teams: LinearTeamOption[] }> {
  const apiKey = requireKey(apiToken);
  type TeamNode = { id: string; key: string; name: string };
  type ProjectNode = { id: string; name: string; teams: { nodes: { id: string }[] } };
  const teams = await linearPaginate<TeamNode, { connection: Connection<TeamNode> }>(
    apiKey,
    TEAMS_QUERY,
    {},
    (data) => data.connection,
    fetch,
  );
  const projects = await linearPaginate<ProjectNode, { connection: Connection<ProjectNode> }>(
    apiKey,
    PROJECTS_QUERY,
    {},
    (data) => data.connection,
    fetch,
  );
  return {
    teams: teams.map((team) => ({
      id: team.id,
      key: team.key,
      name: team.name,
      projects: projects
        .filter((p) => p.teams.nodes.some((t) => t.id === team.id))
        .map((p) => ({ id: p.id, name: p.name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    })),
  };
}

// A team's workflow states in Linear's own order, each with the category the
// import would map it to, for the mapping review step.
export async function previewLinearStates(
  apiToken: string,
  teamId: string,
  fetch: LinearFetch = pinnedFetch,
): Promise<{ states: LinearStateOption[] }> {
  const apiKey = requireKey(apiToken);
  const id = teamId.trim();
  if (!id) throw new HttpError(400, 'teamId is required');
  type StateNode = { id: string; name: string; type: string; position: number };
  const states = await linearPaginate<
    StateNode,
    { team: { connection: Connection<StateNode> } | null }
  >(
    apiKey,
    STATES_QUERY,
    { teamId: id },
    (data) => {
      if (!data.team) throw new HttpError(400, 'Linear team not found.');
      return data.team.connection;
    },
    fetch,
  );
  return {
    states: [...states]
      .sort((a, b) => a.position - b.position)
      .map((s) => ({ id: s.id, name: s.name, category: STATE_CATEGORY_MAP[s.type] ?? 'backlog' })),
  };
}

// What createImportJob stores for a Linear job: the credential and config the
// worker's import-sources.ts reads back.
export function linearJobFields(input: CreateLinearImportJobInput) {
  const apiKey = requireKey(input.apiToken);
  const teamId = input.teamId.trim();
  const teamKey = input.teamKey.trim();
  const projectId = input.projectId?.trim() ?? '';
  if (!teamId) throw new HttpError(400, 'teamId is required');
  if (!teamKey) throw new HttpError(400, 'teamKey is required');
  if (input.projectFilter === 'project' && !projectId) {
    throw new HttpError(400, 'projectId is required to import a project');
  }
  if (input.projectFilter === 'none' && projectId) {
    throw new HttpError(400, 'projectId must be empty to import issues with no project');
  }
  return {
    source: 'linear' as const,
    credential: { apiKey },
    config: {
      teamId,
      teamKey,
      projectFilter: input.projectFilter,
      projectId: input.projectFilter === 'project' ? projectId : null,
    },
  };
}
