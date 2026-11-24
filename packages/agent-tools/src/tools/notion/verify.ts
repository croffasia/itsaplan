import type { CredentialCheck, ToolConfig } from '../../types';
import { NOTION_BASE, NOTION_VERSION } from './client';

// The integration's own bot user, which any valid token can read.
export async function verifyNotion(
  credential: ToolConfig,
  signal: AbortSignal,
): Promise<CredentialCheck> {
  const res = await fetch(`${NOTION_BASE}/users/me`, {
    headers: {
      Authorization: `Bearer ${String(credential.token ?? '')}`,
      'Notion-Version': NOTION_VERSION,
    },
    signal,
  });
  if (res.ok) return 'valid';
  const fromApi = res.headers.get('content-type')?.includes('json');
  return fromApi && res.status === 401 ? 'rejected' : 'unavailable';
}
