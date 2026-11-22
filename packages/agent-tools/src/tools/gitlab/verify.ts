import { pinnedFetch } from '@repo/net';
import type { CredentialCheck, ToolConfig } from '../../types';
import { apiRoot } from './client';

// The token's own user. Only 401 means GitLab does not know the token: a 403 also comes
// for a valid one that may not read the user, such as a fine-grained token without that
// permission. The address may be the credential's own instance, so the call goes
// through the SSRF guard.
export async function verifyGitlab(
  credential: ToolConfig,
  signal: AbortSignal,
): Promise<CredentialCheck> {
  const res = await pinnedFetch(`${apiRoot(credential)}/user`, {
    headers: { 'PRIVATE-TOKEN': String(credential.token ?? '') },
    signal,
  });
  if (res.ok) return 'valid';
  const fromApi = res.headers.get('content-type')?.includes('json');
  return fromApi && res.status === 401 ? 'rejected' : 'unavailable';
}
