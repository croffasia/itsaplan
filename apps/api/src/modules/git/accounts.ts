import {
  db,
  gitManagedRepository,
  gitProviderConnection,
  project,
  projectMember,
  userGitAccount,
} from '@repo/db';
import { decryptSecret, encryptSecret } from '@repo/crypto';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { HttpError, iso } from '#shared/lib';
import {
  getProviderProfile,
  listProviderRepositories,
  normalizeProviderBaseUrl,
  type DevelopmentProvider,
  type ProviderConnectionInput,
} from './connections-provider';
import {
  groupSyncedRepositories,
  syncedRepositoryColumns,
  withSyncedProjects,
  type ReachableRepositoryDto,
  type ReachableRepositoryPageDto,
} from './connections-service';

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

async function signIn(input: GitAccountInput) {
  const token = input.token.trim();
  if (!token) throw new HttpError(400, 'token is required');
  const baseUrl = await normalizeProviderBaseUrl(input.provider, input.baseUrl);
  const profile = await getProviderProfile({ provider: input.provider, baseUrl, token });
  return { baseUrl, token, profile };
}

// The account a token signs in as, without storing anything.
export async function checkGitAccount(input: GitAccountInput): Promise<GitAccountCheck> {
  const { baseUrl, profile } = await signIn(input);
  return {
    provider: input.provider,
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
  const { baseUrl, token, profile } = await signIn(input);
  const values = {
    provider: input.provider,
    baseUrl,
    accountId: profile.id,
    accountLogin: profile.login,
    ...encryptSecret(token),
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

async function ownAccount(userId: string, id: number) {
  const [row] = await db
    .select()
    .from(userGitAccount)
    .where(and(eq(userGitAccount.id, id), eq(userGitAccount.userId, userId)))
    .limit(1);
  return row ?? null;
}

// The user's projects that sync with a repository on the host at `baseUrl`, for every
// repository or for those among `externalIds`. Distinct: a project can sync with one
// repository through two team connections on the same host.
function accountSyncedRows(userId: string, baseUrl: string, externalIds?: string[]) {
  return db
    .selectDistinct(syncedRepositoryColumns)
    .from(gitManagedRepository)
    .innerJoin(
      gitProviderConnection,
      eq(gitProviderConnection.id, gitManagedRepository.connectionId),
    )
    .innerJoin(project, eq(project.id, gitManagedRepository.projectId))
    .innerJoin(
      projectMember,
      and(eq(projectMember.projectId, project.id), eq(projectMember.userId, userId)),
    )
    .where(
      and(
        eq(gitProviderConnection.baseUrl, baseUrl),
        externalIds && inArray(gitManagedRepository.externalId, externalIds),
      ),
    )
    .orderBy(asc(gitManagedRepository.fullName), asc(project.name));
}

// The repositories on the account's host that projects the user is a member of sync with:
// there a comment of theirs goes out under this account. Read without asking the host.
// Null when the user has no such account.
export async function listAccountSyncedRepositories(
  userId: string,
  id: number,
): Promise<ReachableRepositoryDto[] | null> {
  const account = await ownAccount(userId, id);
  if (!account) return null;
  return groupSyncedRepositories(await accountSyncedRows(userId, account.baseUrl));
}

// Every repository the account's token reaches, with the projects the user is a member of
// that sync with each. Null when the user has no such account.
export async function listAccountRepositories(
  userId: string,
  id: number,
  page: number,
  search: string,
): Promise<ReachableRepositoryPageDto | null> {
  const account = await ownAccount(userId, id);
  if (!account) return null;
  const result = await listProviderRepositories(
    {
      provider: account.provider as DevelopmentProvider,
      baseUrl: account.baseUrl,
      token: decryptSecret(account),
    },
    page,
    search.trim(),
    'any',
  );
  const externalIds = result.repositories.map((repository) => repository.externalId);
  return withSyncedProjects(result, await accountSyncedRows(userId, account.baseUrl, externalIds));
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

// The project member who connected the host account `accountId`. Null when nobody did,
// or when several members connected the same account and the comment is no one's alone.
export async function memberForAccount(
  projectId: number,
  baseUrl: string,
  accountId: string,
): Promise<string | null> {
  const rows = await db
    .select({ userId: userGitAccount.userId })
    .from(userGitAccount)
    .innerJoin(
      projectMember,
      and(eq(projectMember.userId, userGitAccount.userId), eq(projectMember.projectId, projectId)),
    )
    .where(and(eq(userGitAccount.baseUrl, baseUrl), eq(userGitAccount.accountId, accountId)))
    .limit(2);
  return rows.length === 1 ? rows[0]!.userId : null;
}
