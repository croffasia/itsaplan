import { authedApi, type Api } from './app';
import { signUpTestUser } from './auth';

// Signs up a user and puts them in the project through the invite flow, on the
// default member role unless a custom one is named. Returns a client acting as
// that member.
export async function addProjectMember(
  asOwner: Api,
  projectKey: string,
  roleId?: number,
): Promise<Api> {
  const user = await signUpTestUser();
  const invite = await asOwner
    .projects({ projectKey })
    .invites.post({ email: user.email, role: 'member', roleId });
  const api = authedApi(user.cookie);
  await api.invites({ token: invite.data!.token }).accept.post();
  return api;
}
