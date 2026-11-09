import type { Api } from './app';

// The team that owns a project, which is where its agents live: a test that addresses
// an agent resolves the team from the project it works in. Never build a route inside
// an async function that returns it — a Treaty node answers to `then`, so awaiting one
// issues a request to `.../then` that never settles. Resolve the id first, then build
// the route where it is called.
export async function teamOf(api: Api, projectKey: string): Promise<number> {
  const projects = await api.projects.get();
  return projects.data!.find((p) => p.key === projectKey)!.teamId;
}

// The project's own id, for the calls that name the projects an agent works in.
export async function projectIdOf(api: Api, projectKey: string): Promise<number> {
  const projects = await api.projects.get();
  return projects.data!.find((p) => p.key === projectKey)!.id;
}

type CreateAgentBody = Parameters<ReturnType<Api['teams']>['ai-agents']['post']>[0];

// Creates an agent on the team that owns the project and attaches it to that project,
// which is what an agent bound to one project looks like now. It joins on the team's
// default role, which a test that cares about the role reassigns afterwards.
// Returns the raw response so a test can assert on its status.
export async function createAgent(api: Api, projectKey: string, body: CreateAgentBody) {
  const projects = await api.projects.get();
  const project = projects.data!.find((p) => p.key === projectKey)!;
  return api.teams({ teamId: project.teamId })['ai-agents'].post({
    projectIds: [project.id],
    ...body,
  });
}

// Puts the agent's membership of a project on a role, the way the project's member
// list does. An agent joins on the default role, so this is how a test gives
// it the role its calls are then checked against.
export async function setAgentProjectRole(
  api: Api,
  projectKey: string,
  userId: string,
  roleId: number,
) {
  return api.projects({ projectKey }).members({ userId }).patch({ role: 'member', roleId });
}
