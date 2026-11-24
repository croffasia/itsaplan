import type { CredentialCheck, ToolConfig } from '../../types';

// getMe answers 401 to a token Telegram does not know and 404 to a malformed one.
export async function verifyTelegram(
  credential: ToolConfig,
  signal: AbortSignal,
): Promise<CredentialCheck> {
  const res = await fetch(`https://api.telegram.org/bot${String(credential.botToken)}/getMe`, {
    signal,
  });
  if (res.ok) return 'valid';
  const fromApi = res.headers.get('content-type')?.includes('json');
  return fromApi && (res.status === 401 || res.status === 404) ? 'rejected' : 'unavailable';
}
