import type { Api } from './app';

// Stores a credential on the team that owns a project — credentials live on the team,
// so a test that needs one for a project resolves its team first. Returns its id.
export async function createCredential(
  api: Api,
  projectKey: string,
  body: {
    integrationKey: string;
    label?: string | null;
    credential: Record<string, unknown>;
  },
): Promise<number> {
  const projects = await api.projects.get();
  const project = projects.data!.find((p) => p.key === projectKey)!;
  const res = await api.teams({ teamId: project.teamId }).integrations.post(body);
  return res.data!.id;
}

// Lets a credential name a model server the test runs on its own machine, which the
// base URL check otherwise refuses as private. Returns the call that undoes it.
export function allowLocalModel(baseUrl: string): () => void {
  const previous = process.env.LLM_ALLOWED_PRIVATE_HOSTS;
  process.env.LLM_ALLOWED_PRIVATE_HOSTS = [previous, new URL(baseUrl).host]
    .filter(Boolean)
    .join(',');
  return () => {
    if (previous === undefined) delete process.env.LLM_ALLOWED_PRIVATE_HOSTS;
    else process.env.LLM_ALLOWED_PRIVATE_HOSTS = previous;
  };
}
