import { db, calendarConnection } from '@repo/db';
import { and, eq, sql } from 'drizzle-orm';
import { decryptSecret, encryptSecret, type EncryptedSecret } from '@repo/crypto';
import { refreshAccessToken, type GoogleTokens } from './google';

// The connection row without its tokens. Every column list here is written out so a
// token blob cannot reach a response by being picked up with `select()`.
export interface CalendarConnection {
  id: number;
  accountEmail: string;
  scopes: string[];
  hiddenCalendarIds: string[];
  lastError: string | null;
  createdAt: string;
}

const REFRESH_MARGIN_MS = 60_000;

const publicColumns = {
  id: calendarConnection.id,
  accountEmail: calendarConnection.accountEmail,
  scopes: calendarConnection.scopes,
  hiddenCalendarIds: calendarConnection.hiddenCalendarIds,
  lastError: calendarConnection.lastError,
  createdAt: calendarConnection.createdAt,
};

function present(row: {
  id: number;
  accountEmail: string;
  scopes: string[];
  hiddenCalendarIds: string[];
  lastError: string | null;
  createdAt: Date;
}): CalendarConnection {
  return { ...row, createdAt: row.createdAt.toISOString() };
}

function member(projectId: number, userId: string) {
  return and(
    eq(calendarConnection.projectId, projectId),
    eq(calendarConnection.userId, userId),
    eq(calendarConnection.provider, 'google'),
  );
}

export async function getConnection(
  projectId: number,
  userId: string,
): Promise<CalendarConnection | null> {
  const rows = await db
    .select(publicColumns)
    .from(calendarConnection)
    .where(member(projectId, userId));
  return rows[0] ? present(rows[0]) : null;
}

export async function saveConnection(
  projectId: number,
  userId: string,
  accountEmail: string,
  tokens: GoogleTokens,
  scopes: string[],
): Promise<void> {
  const encrypted = encryptSecret(JSON.stringify(tokens));
  await db
    .insert(calendarConnection)
    .values({
      projectId,
      userId,
      accountEmail,
      tokens: encrypted as unknown as Record<string, unknown>,
      scopes,
    })
    .onConflictDoUpdate({
      target: [
        calendarConnection.projectId,
        calendarConnection.userId,
        calendarConnection.provider,
      ],
      set: {
        accountEmail,
        tokens: encrypted as unknown as Record<string, unknown>,
        scopes,
        lastError: null,
        updatedAt: sql`now()`,
      },
    });
}

// The refresh token, needed to revoke the grant at Google before the row is removed.
export async function takeRefreshToken(projectId: number, userId: string): Promise<string | null> {
  const rows = await db
    .select({ tokens: calendarConnection.tokens })
    .from(calendarConnection)
    .where(member(projectId, userId));
  if (!rows[0]) return null;
  try {
    return (JSON.parse(decryptSecret(rows[0].tokens as unknown as EncryptedSecret)) as GoogleTokens)
      .refreshToken;
  } catch {
    return null;
  }
}

export async function deleteConnection(projectId: number, userId: string): Promise<void> {
  await db.delete(calendarConnection).where(member(projectId, userId));
}

export async function setHiddenCalendars(
  projectId: number,
  userId: string,
  hiddenCalendarIds: string[],
): Promise<void> {
  await db
    .update(calendarConnection)
    .set({ hiddenCalendarIds, updatedAt: sql`now()` })
    .where(member(projectId, userId));
}

export async function setLastError(
  projectId: number,
  userId: string,
  lastError: string | null,
): Promise<void> {
  await db
    .update(calendarConnection)
    .set({ lastError, updatedAt: sql`now()` })
    .where(member(projectId, userId));
}

// The only reader of the token blob. It hands back an access token that is valid for
// at least another minute, refreshing and storing a new one when it is not. Every
// call to Google goes through here, so a stored token is never used past its life.
export async function getAccessToken(projectId: number, userId: string): Promise<string | null> {
  const rows = await db
    .select({ tokens: calendarConnection.tokens })
    .from(calendarConnection)
    .where(member(projectId, userId));
  if (!rows[0]) return null;

  const stored = JSON.parse(
    decryptSecret(rows[0].tokens as unknown as EncryptedSecret),
  ) as GoogleTokens;
  if (stored.accessTokenExpiresAt - REFRESH_MARGIN_MS > Date.now()) return stored.accessToken;

  const refreshed = await refreshAccessToken(stored.refreshToken);
  const encrypted = encryptSecret(JSON.stringify(refreshed));
  await db
    .update(calendarConnection)
    .set({
      tokens: encrypted as unknown as Record<string, unknown>,
      lastError: null,
      updatedAt: sql`now()`,
    })
    .where(member(projectId, userId));
  return refreshed.accessToken;
}
