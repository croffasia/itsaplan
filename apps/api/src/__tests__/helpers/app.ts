import { treaty } from '@elysiajs/eden';
import { app } from '../../app';

// The app itself, for a route Treaty cannot drive (an event stream, where there is no
// JSON body to hand back).
export { app };

// Anonymous Eden Treaty client bound to the in-memory app (no network, no port).
// Use for unauthenticated routes; planner routes return 401 through this.
export const api = treaty(app);

// Treaty client that sends a session cookie on every request. Pass additional
// headers when the route behavior depends on request metadata.
export function authedApi(cookie: string, headers?: Record<string, string>) {
  return treaty(app, { headers: { ...headers, cookie } });
}

// Treaty client that authenticates with an API key instead of a session cookie —
// how an external agent and its runner call the API.
export function apiKeyApi(apiKey: string) {
  return treaty(app, { headers: { 'x-api-key': apiKey } });
}

// Treaty client that authenticates with the instance SCIM token — how an identity
// provider calls /scim/v2.
export function scimApi(token: string) {
  return treaty(app, { headers: { authorization: `Bearer ${token}` } });
}

export type Api = typeof api;

// The workspace the caller owns, where a test creates teams of its own.
export async function ownWorkspaceId(client: Api): Promise<number> {
  const own = (await client.workspaces.get()).data?.find((w) => w.role === 'owner');
  if (!own) throw new Error('ownWorkspaceId: the caller owns no workspace');
  return own.id;
}

type CreateProjectBody = Parameters<ReturnType<Api['teams']>['projects']['post']>[0];

// Creates a project in the first team the caller owns, the team signUpTestUser gives it.
export async function createProject(client: Api, body: CreateProjectBody) {
  const teams = (await client.teams.get()).data ?? [];
  const own = teams
    .filter((team) => team.role === 'owner' && team.via === 'member')
    .sort((a, b) => a.id - b.id)[0];
  if (!own) throw new Error('createProject: the caller owns no team');
  return client.teams({ teamId: own.id }).projects.post(body);
}
