import {
  db,
  oauthAccessToken,
  oauthClient,
  oauthConsent,
  oauthRefreshToken,
  verification,
} from '@repo/db';
import { and, eq, gt, inArray, isNull, like } from 'drizzle-orm';

export interface ConnectedApp {
  clientId: string;
  name: string;
  icon: string | null;
  scopes: string[];
  connectedAt: string;
  lastUsedAt: string | null;
}

// An application is connected while the user's consent stands or one of its refresh
// tokens can still mint access tokens; an expired token alone is history.
export async function listConnectedApps(userId: string): Promise<ConnectedApp[]> {
  const [consents, refreshTokens] = await Promise.all([
    db.select().from(oauthConsent).where(eq(oauthConsent.userId, userId)),
    db
      .select()
      .from(oauthRefreshToken)
      .where(
        and(
          eq(oauthRefreshToken.userId, userId),
          isNull(oauthRefreshToken.revoked),
          gt(oauthRefreshToken.expiresAt, new Date()),
        ),
      ),
  ]);
  const clientIds = [...new Set([...consents, ...refreshTokens].map((row) => row.clientId))];
  if (clientIds.length === 0) return [];
  const clients = await db
    .select()
    .from(oauthClient)
    .where(inArray(oauthClient.clientId, clientIds));

  return clients
    .map((client) => {
      const consent = consents.find((c) => c.clientId === client.clientId);
      const issued = refreshTokens
        .filter((tk) => tk.clientId === client.clientId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const connectedAt = consent?.createdAt ?? issued.at(-1)!.createdAt;
      return {
        clientId: client.clientId,
        name: client.name || client.clientId,
        icon: client.icon,
        scopes: consent?.scopes ?? issued[0]!.scopes,
        connectedAt: connectedAt.toISOString(),
        lastUsedAt: issued[0]?.createdAt.toISOString() ?? null,
      };
    })
    .sort((a, b) => b.connectedAt.localeCompare(a.connectedAt));
}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

// better-auth keeps an authorization code in `verification` as JSON until it is exchanged,
// and the exchange checks neither the consent nor the tokens, so a code issued just before
// the disconnection would connect the client again. Only a code carries that marker; the
// exact match below rejects anything else the prefilter lets through.
async function deletePendingCodes(tx: Transaction, userId: string, clientId: string) {
  const candidates = await tx
    .select({ id: verification.id, value: verification.value })
    .from(verification)
    .where(
      and(
        like(verification.value, '%"authorization_code"%'),
        like(verification.value, `%${userId}%`),
      ),
    );
  const ids = candidates
    .filter((row) => {
      try {
        const code = JSON.parse(row.value) as {
          type?: string;
          userId?: string;
          query?: { client_id?: string };
        };
        return (
          code.type === 'authorization_code' &&
          code.userId === userId &&
          code.query?.client_id === clientId
        );
      } catch {
        return false;
      }
    })
    .map((row) => row.id);
  if (ids.length > 0) await tx.delete(verification).where(inArray(verification.id, ids));
}

// Drops the consent with the tokens: a client left with the consent would get new
// tokens on its next authorize. The client registration stays; it is not the user's.
export async function revokeConnectedApp(userId: string, clientId: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    await deletePendingCodes(tx, userId, clientId);
    await tx
      .delete(oauthAccessToken)
      .where(and(eq(oauthAccessToken.userId, userId), eq(oauthAccessToken.clientId, clientId)));
    const tokens = await tx
      .delete(oauthRefreshToken)
      .where(and(eq(oauthRefreshToken.userId, userId), eq(oauthRefreshToken.clientId, clientId)))
      .returning({ id: oauthRefreshToken.id });
    const consents = await tx
      .delete(oauthConsent)
      .where(and(eq(oauthConsent.userId, userId), eq(oauthConsent.clientId, clientId)))
      .returning({ id: oauthConsent.id });
    return tokens.length + consents.length > 0;
  });
}
