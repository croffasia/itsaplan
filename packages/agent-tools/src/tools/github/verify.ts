import { pinnedFetch } from '@repo/net';
import type { CredentialCheck, ToolConfig } from '../../types';
import { API_VERSION, apiRoot } from './client';

// The token's own user. Only 401 means GitHub does not know the token: a 403 is also a
// rate limit or an organization's SSO block on a valid one. The address may be the
// credential's own Enterprise Server, so the call goes through the SSRF guard.
export async function verifyGithub(
  credential: ToolConfig,
  signal: AbortSignal,
): Promise<CredentialCheck> {
  const res = await pinnedFetch(`${apiRoot(credential)}/user`, {
    headers: {
      Authorization: `Bearer ${String(credential.token ?? '')}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': API_VERSION,
      'User-Agent': 'itsaplan',
    },
    signal,
  });
  if (res.ok) return 'valid';
  const fromApi = res.headers.get('content-type')?.includes('json');
  return fromApi && res.status === 401 ? 'rejected' : 'unavailable';
}
