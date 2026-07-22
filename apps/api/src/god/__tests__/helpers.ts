import { authedApi, type Api } from '../../__tests__/helpers/app';
import { signUpTestUser } from '../../__tests__/helpers/auth';

// Actors and the flows both god directory tests need. The first user in a reset
// database gets the "god" role, so `setup` registers the instance owner first and
// every other actor is a plain user.

export interface Actor {
  id: string;
  email: string;
  api: Api;
}

export async function addUser(overrides: { name?: string; email?: string } = {}): Promise<Actor> {
  const user = await signUpTestUser(overrides);
  return { id: user.userId, email: user.email, api: authedApi(user.cookie) };
}

export async function setup(): Promise<{ god: Actor }> {
  return { god: await addUser({ name: 'Root', email: 'root@example.com' }) };
}

// Adds `invitee` to the given project on the given role, through the real invite
// and accept flow rather than a direct membership insert.
export async function joinProject(
  owner: Actor,
  invitee: Actor,
  projectKey: string,
  role: 'owner' | 'member',
): Promise<void> {
  const invite = await owner.api
    .projects({ projectKey })
    .invites.post({ email: invitee.email, role });
  await invitee.api.invites({ token: invite.data!.token }).accept.post();
}

// Creates an external AI agent on the given project and returns its bot user id.
export async function createAgentUser(owner: Actor, projectKey: string): Promise<string> {
  const created = await owner.api.projects({ projectKey })['ai-agents'].post({
    name: 'Webhook Bot',
    username: 'webhook',
    kind: 'external',
  });
  return created.data!.agent.userId;
}
