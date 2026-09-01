import { and, desc, eq } from 'drizzle-orm';
import { db, account } from '@repo/db';
import { auth, OIDC_PROVIDER_ID } from '@repo/auth';
import { groupDisplayNames } from './resource';
import { syncEmbeddedGroups } from './service';

// Folds an OIDC sign-in's `groups` claim into the same scim_group /
// scim_group_member tables a SCIM sync writes to, so a group mapped to a project in
// god mode grants access on an instance that uses OIDC, SCIM, or both. Runs after
// every successful callback, not just the first one, so membership follows the
// provider going forward.
//
// The claim lives in the ID token, not necessarily the userinfo response some
// providers keep small — better-auth stores the raw token on the linked `account`
// row (`idToken`), so it is read from there rather than re-fetching anything.
// Reading its payload needs no signature check: this token already went through
// better-auth's own exchange with the provider's token endpoint over TLS, and nothing
// here relies on it for authentication — only on an optional claim used to seed
// project access.
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const segment = token.split('.')[1];
  if (!segment) return null;
  try {
    const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// Called with the response of `/api/auth/oauth2/callback/:providerId`, whose
// Set-Cookie header resolves the session a successful sign-in just opened. Best
// effort throughout: a decode failure, a missing claim, or a DB error is logged and
// swallowed rather than surfaced, since none of it should turn a successful sign-in
// into a failed one.
export async function syncOidcGroupsAfterCallback(response: Response): Promise<void> {
  try {
    const cookie = response.headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .join('; ');
    if (!cookie) return;

    const session = await auth.api.getSession({ headers: new Headers({ cookie }) });
    if (!session) return;

    const rows = await db
      .select({ idToken: account.idToken })
      .from(account)
      .where(and(eq(account.userId, session.user.id), eq(account.providerId, OIDC_PROVIDER_ID)))
      .orderBy(desc(account.updatedAt))
      .limit(1);
    const idToken = rows[0]?.idToken;
    if (!idToken) return;

    const claims = decodeJwtPayload(idToken);
    const names = groupDisplayNames(claims?.groups);
    await syncEmbeddedGroups(session.user.id, names);
  } catch (error) {
    console.error('[scim] OIDC group sync failed:', error);
  }
}
