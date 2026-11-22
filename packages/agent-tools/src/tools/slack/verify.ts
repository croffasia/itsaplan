import type { CredentialCheck, ToolConfig } from '../../types';

const REFUSALS = new Set(['invalid_auth', 'not_authed', 'account_inactive', 'token_revoked']);

// auth.test needs no scope. Slack answers a token it does not accept with ok:false and
// one of the refusal codes.
export async function verifySlack(
  credential: ToolConfig,
  signal: AbortSignal,
): Promise<CredentialCheck> {
  const res = await fetch('https://slack.com/api/auth.test', {
    method: 'POST',
    headers: { authorization: `Bearer ${String(credential.botToken)}` },
    signal,
  });
  if (!res.ok) return 'unavailable';
  const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
  if (body?.ok) return 'valid';
  return REFUSALS.has(body?.error ?? '') ? 'rejected' : 'unavailable';
}
