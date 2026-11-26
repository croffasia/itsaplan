import { db, projectMember, userGitAccount } from '@repo/db';
import { decryptSecret, encryptSecret } from '@repo/crypto';
import { and, asc, eq } from 'drizzle-orm';
import { HttpError, iso } from '#shared/lib';
import {
  getProviderProfile,
  normalizeProviderBaseUrl,
  type DevelopmentProvider,
  type ProviderConnectionInput,
} from './connections-provider';

// A member's own account on a repository host. The team's connection reads issues and
// changes their state; a comment written here goes to a synced repository issue only
// under its author's account, so it reads there as theirs.

export interface GitAccountDto {
  id: number;
  provider: DevelopmentProvider;
  baseUrl: string;
  accountLogin: string;
  createdAt: string;
}

export interface GitAccountInput {
  provider: DevelopmentProvider;
  baseUrl?: string;
  token: string;
}

export interface GitAccountCheck {
  provider: DevelopmentProvider;
  baseUrl: string;
  accountLogin: string;
  // The account's display name and picture on the host, shown before it is connected.
  accountName: string | null;
  avatarUrl: string | null;
}

// The account a token signs in as, without storing anything.
export async function checkGitAccount(input: GitAccountInput): Promise<GitAccountCheck> {
  const { provider } = input;
  const token = input.token.trim();
  if (!token) throw new HttpError(400, 'token is required');
  const baseUrl = await normalizeProviderBaseUrl(provider, input.baseUrl);
  const profile = await getProviderProfile({ provider, baseUrl, token });
  return {
    provider,
    baseUrl,
    accountLogin: profile.login,
    accountName: profile.name,
    avatarUrl: profile.avatarUrl,
  };
}

function toDto(row: typeof userGitAccount.$inferSelect): GitAccountDto {
  return {
    id: row.id,
    provider: row.provider as DevelopmentProvider,
    baseUrl: row.baseUrl,
    accountLogin: row.accountLogin,
    createdAt: iso(row.createdAt),
  };
}

export async function listGitAccounts(userId: string): Promise<GitAccountDto[]> {
  const rows = await db
    .select()
    .from(userGitAccount)
    .where(eq(userGitAccount.userId, userId))
    .orderBy(asc(userGitAccount.baseUrl));
  return rows.map(toDto);
}

// One account per host: connecting another one there replaces it.
export async function connectGitAccount(
  userId: string,
  input: GitAccountInput,
): Promise<GitAccountDto> {
  const { provider, baseUrl, accountLogin } = await checkGitAccount(input);
  const values = {
    provider,
    baseUrl,
    accountLogin,
    ...encryptSecret(input.token.trim()),
    updatedAt: new Date(),
  };
  const [row] = await db
    .insert(userGitAccount)
    .values({ userId, ...values })
    .onConflictDoUpdate({ target: [userGitAccount.userId, userGitAccount.baseUrl], set: values })
    .returning();
  return toDto(row!);
}

export async function disconnectGitAccount(userId: string, id: number): Promise<boolean> {
  const deleted = await db
    .delete(userGitAccount)
    .where(and(eq(userGitAccount.id, id), eq(userGitAccount.userId, userId)))
    .returning({ id: userGitAccount.id });
  return deleted.length > 0;
}

// The member's account on the host at `baseUrl`, ready for a provider call.
export async function memberAccountInput(
  userId: string,
  baseUrl: string,
): Promise<ProviderConnectionInput | null> {
  const [row] = await db
    .select()
    .from(userGitAccount)
    .where(and(eq(userGitAccount.userId, userId), eq(userGitAccount.baseUrl, baseUrl)))
    .limit(1);
  if (!row) return null;
  return {
    provider: row.provider as DevelopmentProvider,
    baseUrl: row.baseUrl,
    token: decryptSecret(row),
  };
}

// The project member who connected the account `login` on the host. Null when nobody
// did, or when several members connected the same account and the comment is no one's
// alone.
export async function memberForAccount(
  projectId: number,
  baseUrl: string,
  login: string,
): Promise<string | null> {
  const rows = await db
    .select({ userId: userGitAccount.userId })
    .from(userGitAccount)
    .innerJoin(
      projectMember,
      and(eq(projectMember.userId, userGitAccount.userId), eq(projectMember.projectId, projectId)),
    )
    .where(and(eq(userGitAccount.baseUrl, baseUrl), eq(userGitAccount.accountLogin, login)))
    .limit(2);
  return rows.length === 1 ? rows[0]!.userId : null;
}
