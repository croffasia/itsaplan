import type { Api } from './app';

// The team that owns a project. Roles live on the team, so a test that works with the
// roles of a project resolves its team first.
export async function teamIdOf(api: Api, projectKey: string): Promise<number> {
  const projects = await api.projects.get();
  return projects.data!.find((p) => p.key === projectKey)!.teamId;
}

// The roles a project assigns from, through the team that owns it. Read whole, the
// way the pickers do.
export async function listProjectRoles(api: Api, projectKey: string) {
  return api.teams({ teamId: await teamIdOf(api, projectKey) }).roles.options.get();
}

// Creates a role for a project through the team that owns it.
export async function createRole(
  api: Api,
  projectKey: string,
  body: { name: string; permissions: unknown },
) {
  return api.teams({ teamId: await teamIdOf(api, projectKey) }).roles.post(body);
}
