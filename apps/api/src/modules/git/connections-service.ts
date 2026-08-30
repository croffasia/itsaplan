import { db, gitManagedRepository, gitProviderConnection } from '@repo/db';
import { decryptSecret, encryptSecret } from '@repo/crypto';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { HttpError, iso } from '#shared/lib';
import {
  createProviderPullRequest,
  deleteProviderWebhook,
  createPullRequestComment,
  getProviderAccount,
  getProviderPullRequest,
  getProviderRepository,
  installProviderWebhook,
  listProviderBranches,
  listProviderPullRequests,
  listProviderRepositories,
  normalizeProviderBaseUrl,
  type CreateProviderPullRequestInput,
  type GitProvider,
  type ProviderBranchPage,
  type ProviderConnectionInput,
  type ProviderPullRequestDetails,
  type ProviderPullRequestPage,
  type ProviderRepository,
} from './connections-provider';
import { getOrCreateGitSettings, type GitSettings } from './service';

export interface GitProviderConnectionDto {
  id: number;
  provider: GitProvider;
  baseUrl: string;
  accountLogin: string;
  repositories: GitManagedRepositoryDto[];
  createdAt: string;
  updatedAt: string;
}

export interface GitManagedRepositoryDto {
  id: number;
  externalId: string;
  fullName: string;
  webUrl: string;
  status: 'connected' | 'error';
  lastError: string | null;
}

export interface DevelopmentRepositoryDto {
  id: number;
  provider: 'github' | 'gitlab';
  fullName: string;
  webUrl: string;
}

interface ConnectionSecret {
  provider: GitProvider;
  baseUrl: string;
  token: string;
}

const repositoryColumns = {
  id: gitManagedRepository.id,
  externalId: gitManagedRepository.externalId,
  fullName: gitManagedRepository.fullName,
  webUrl: gitManagedRepository.webUrl,
  status: gitManagedRepository.status,
  lastError: gitManagedRepository.lastError,
};

function mapRepository(row: {
  id: number;
  externalId: string;
  fullName: string;
  webUrl: string;
  status: string;
  lastError: string | null;
}): GitManagedRepositoryDto {
  return { ...row, status: row.status === 'error' ? 'error' : 'connected' };
}

interface ManagedDevelopmentRepository {
  input: ProviderConnectionInput & { provider: 'github' | 'gitlab' };
  repository: ProviderRepository;
}

async function managedDevelopmentRepository(
  projectId: number,
  repositoryId: number,
): Promise<ManagedDevelopmentRepository> {
  const [row] = await db
    .select({
      provider: gitProviderConnection.provider,
      baseUrl: gitProviderConnection.baseUrl,
      ciphertext: gitProviderConnection.ciphertext,
      iv: gitProviderConnection.iv,
      authTag: gitProviderConnection.authTag,
      externalId: gitManagedRepository.externalId,
      fullName: gitManagedRepository.fullName,
      webUrl: gitManagedRepository.webUrl,
    })
    .from(gitManagedRepository)
    .innerJoin(
      gitProviderConnection,
      eq(gitManagedRepository.connectionId, gitProviderConnection.id),
    )
    .where(
      and(
        eq(gitManagedRepository.id, repositoryId),
        eq(gitProviderConnection.projectId, projectId),
        eq(gitManagedRepository.status, 'connected'),
      ),
    )
    .limit(1);
  if (!row) throw new HttpError(404, 'Managed repository not found');
  if (row.provider !== 'github' && row.provider !== 'gitlab')
    throw new HttpError(400, 'Creating and linking pull requests supports GitHub and GitLab');
  return {
    input: { provider: row.provider, baseUrl: row.baseUrl, token: decryptSecret(row) },
    repository: {
      externalId: row.externalId,
      fullName: row.fullName,
      webUrl: row.webUrl,
      private: false,
    },
  };
}

export async function listDevelopmentRepositories(
  projectId: number,
): Promise<DevelopmentRepositoryDto[]> {
  const rows = await db
    .select({
      id: gitManagedRepository.id,
      provider: gitProviderConnection.provider,
      fullName: gitManagedRepository.fullName,
      webUrl: gitManagedRepository.webUrl,
    })
    .from(gitManagedRepository)
    .innerJoin(
      gitProviderConnection,
      eq(gitManagedRepository.connectionId, gitProviderConnection.id),
    )
    .where(
      and(
        eq(gitProviderConnection.projectId, projectId),
        eq(gitManagedRepository.status, 'connected'),
        inArray(gitProviderConnection.provider, ['github', 'gitlab']),
      ),
    )
    .orderBy(asc(gitProviderConnection.provider), asc(gitManagedRepository.fullName));
  return rows.map((row) => ({ ...row, provider: row.provider as 'github' | 'gitlab' }));
}

export async function listManagedPullRequests(
  projectId: number,
  repositoryId: number,
  state: 'open' | 'all',
  page: number,
): Promise<{ provider: 'github' | 'gitlab'; repository: string; page: ProviderPullRequestPage }> {
  const managed = await managedDevelopmentRepository(projectId, repositoryId);
  return {
    provider: managed.input.provider,
    repository: managed.repository.fullName,
    page: await listProviderPullRequests(managed.input, managed.repository, state, page),
  };
}

export async function getManagedPullRequest(
  projectId: number,
  repositoryId: number,
  number: number,
): Promise<{ provider: 'github' | 'gitlab'; details: ProviderPullRequestDetails }> {
  const managed = await managedDevelopmentRepository(projectId, repositoryId);
  return {
    provider: managed.input.provider,
    details: await getProviderPullRequest(managed.input, managed.repository, number),
  };
}

export async function listManagedBranches(
  projectId: number,
  repositoryId: number,
  page: number,
): Promise<ProviderBranchPage> {
  const managed = await managedDevelopmentRepository(projectId, repositoryId);
  return listProviderBranches(managed.input, managed.repository, page);
}

export async function createManagedPullRequest(
  projectId: number,
  repositoryId: number,
  input: CreateProviderPullRequestInput,
): Promise<{ provider: 'github' | 'gitlab'; details: ProviderPullRequestDetails }> {
  const managed = await managedDevelopmentRepository(projectId, repositoryId);
  return {
    provider: managed.input.provider,
    details: await createProviderPullRequest(managed.input, managed.repository, input),
  };
}

async function repositoriesByConnection(
  connectionIds: number[],
): Promise<Map<number, GitManagedRepositoryDto[]>> {
  if (connectionIds.length === 0) return new Map();
  const rows = await db
    .select({ connectionId: gitManagedRepository.connectionId, ...repositoryColumns })
    .from(gitManagedRepository)
    .where(inArray(gitManagedRepository.connectionId, connectionIds))
    .orderBy(asc(gitManagedRepository.fullName));
  const grouped = new Map<number, GitManagedRepositoryDto[]>();
  for (const row of rows) {
    const repositories = grouped.get(row.connectionId) ?? [];
    repositories.push(mapRepository(row));
    grouped.set(row.connectionId, repositories);
  }
  return grouped;
}

export async function listGitProviderConnections(
  projectId: number,
): Promise<GitProviderConnectionDto[]> {
  const rows = await db
    .select({
      id: gitProviderConnection.id,
      provider: gitProviderConnection.provider,
      baseUrl: gitProviderConnection.baseUrl,
      accountLogin: gitProviderConnection.accountLogin,
      createdAt: gitProviderConnection.createdAt,
      updatedAt: gitProviderConnection.updatedAt,
    })
    .from(gitProviderConnection)
    .where(eq(gitProviderConnection.projectId, projectId))
    .orderBy(asc(gitProviderConnection.provider), asc(gitProviderConnection.baseUrl));
  const repositories = await repositoriesByConnection(rows.map((row) => row.id));
  return rows.map((row) => ({
    id: row.id,
    provider: row.provider as GitProvider,
    baseUrl: row.baseUrl,
    accountLogin: row.accountLogin,
    repositories: repositories.get(row.id) ?? [],
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  }));
}

async function connectionSecret(id: number, projectId: number): Promise<ConnectionSecret> {
  const rows = await db
    .select()
    .from(gitProviderConnection)
    .where(and(eq(gitProviderConnection.id, id), eq(gitProviderConnection.projectId, projectId)))
    .limit(1);
  const row = rows[0];
  if (!row) throw new HttpError(404, 'Provider connection not found');
  if (!['github', 'gitlab', 'gitea', 'forgejo', 'bitbucket'].includes(row.provider)) {
    throw new HttpError(400, 'Unknown Git provider');
  }
  return {
    provider: row.provider as GitProvider,
    baseUrl: row.baseUrl,
    token: decryptSecret(row),
  };
}

function providerInput(connection: ConnectionSecret): ProviderConnectionInput {
  return {
    provider: connection.provider,
    baseUrl: connection.baseUrl,
    token: connection.token,
  };
}

export async function connectGitProvider(
  projectId: number,
  input: { provider: GitProvider; baseUrl?: string; token: string },
): Promise<GitProviderConnectionDto> {
  const token = input.token.trim();
  if (!token) throw new HttpError(400, 'token is required');
  const baseUrl = await normalizeProviderBaseUrl(input.provider, input.baseUrl);
  const accountLogin = await getProviderAccount({ provider: input.provider, baseUrl, token });
  const encrypted = encryptSecret(token);
  const rows = await db
    .insert(gitProviderConnection)
    .values({ projectId, provider: input.provider, baseUrl, accountLogin, ...encrypted })
    .onConflictDoUpdate({
      target: [
        gitProviderConnection.projectId,
        gitProviderConnection.provider,
        gitProviderConnection.baseUrl,
        gitProviderConnection.accountLogin,
      ],
      set: { accountLogin, ...encrypted, updatedAt: new Date() },
    })
    .returning({ id: gitProviderConnection.id });
  const connections = await listGitProviderConnections(projectId);
  const connection = connections.find((item) => item.id === rows[0]?.id);
  if (!connection) throw new HttpError(500, 'Provider connection was not stored');
  return connection;
}

export async function listAvailableRepositories(
  projectId: number,
  connectionId: number,
  page: number,
  search: string,
) {
  const connection = await connectionSecret(connectionId, projectId);
  const result = await listProviderRepositories(providerInput(connection), page, search.trim());
  const managed = await db
    .select({ id: gitManagedRepository.id, externalId: gitManagedRepository.externalId })
    .from(gitManagedRepository)
    .where(eq(gitManagedRepository.connectionId, connectionId));
  const managedByExternalId = new Map(managed.map((repo) => [repo.externalId, repo.id]));
  return {
    repositories: result.repositories.map((repo) => ({
      ...repo,
      managedRepositoryId: managedByExternalId.get(repo.externalId) ?? null,
    })),
    nextPage: result.nextPage,
  };
}

function webhookPayloadUrl(settings: GitSettings): string {
  const apiUrl = process.env.API_URL;
  if (!apiUrl) throw new HttpError(500, 'API_URL is not configured');
  return `${apiUrl.replace(/\/$/, '')}/webhooks/git/${settings.webhookId}`;
}

export async function connectRepositories(
  projectId: number,
  connectionId: number,
  externalIds: string[],
): Promise<GitProviderConnectionDto> {
  const ids = [...new Set(externalIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) throw new HttpError(400, 'Select at least one repository');
  if (ids.length > 50) throw new HttpError(400, 'Select at most 50 repositories');
  const connection = await connectionSecret(connectionId, projectId);
  const existing = await db
    .select({ externalId: gitManagedRepository.externalId })
    .from(gitManagedRepository)
    .where(
      and(
        eq(gitManagedRepository.connectionId, connectionId),
        inArray(gitManagedRepository.externalId, ids),
      ),
    );
  const existingIds = new Set(existing.map((repo) => repo.externalId));
  const settings = await getOrCreateGitSettings(projectId);
  const payloadUrl = webhookPayloadUrl(settings);
  for (const externalId of ids) {
    if (existingIds.has(externalId)) continue;
    const repository = await getProviderRepository(providerInput(connection), externalId);
    const webhookExternalId = await installProviderWebhook(
      providerInput(connection),
      repository,
      payloadUrl,
      settings.secret,
    );
    await db.insert(gitManagedRepository).values({
      connectionId,
      externalId: repository.externalId,
      fullName: repository.fullName,
      webUrl: repository.webUrl,
      webhookExternalId,
    });
  }
  return connectionDto(projectId, connectionId);
}

async function connectionDto(projectId: number, connectionId: number) {
  const connections = await listGitProviderConnections(projectId);
  const connection = connections.find((item) => item.id === connectionId);
  if (!connection) throw new HttpError(404, 'Provider connection not found');
  return connection;
}

export async function disconnectRepository(
  projectId: number,
  connectionId: number,
  repositoryId: number,
): Promise<void> {
  const connection = await connectionSecret(connectionId, projectId);
  const rows = await db
    .select()
    .from(gitManagedRepository)
    .where(
      and(
        eq(gitManagedRepository.id, repositoryId),
        eq(gitManagedRepository.connectionId, connectionId),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) throw new HttpError(404, 'Managed repository not found');
  await deleteProviderWebhook(
    providerInput(connection),
    { externalId: row.externalId, fullName: row.fullName, webUrl: row.webUrl, private: false },
    row.webhookExternalId,
  );
  await db.delete(gitManagedRepository).where(eq(gitManagedRepository.id, repositoryId));
}

export async function disconnectGitProvider(
  projectId: number,
  connectionId: number,
): Promise<void> {
  const connection = await connectionSecret(connectionId, projectId);
  const repositories = await db
    .select()
    .from(gitManagedRepository)
    .where(eq(gitManagedRepository.connectionId, connectionId));
  for (const repository of repositories) {
    await deleteProviderWebhook(
      providerInput(connection),
      {
        externalId: repository.externalId,
        fullName: repository.fullName,
        webUrl: repository.webUrl,
        private: false,
      },
      repository.webhookExternalId,
    );
  }
  await db
    .delete(gitProviderConnection)
    .where(
      and(
        eq(gitProviderConnection.id, connectionId),
        eq(gitProviderConnection.projectId, projectId),
      ),
    );
}

export async function reconcileManagedWebhooks(
  projectId: number,
  settings: GitSettings,
): Promise<void> {
  const connections = await listGitProviderConnections(projectId);
  const payloadUrl = webhookPayloadUrl(settings);
  for (const item of connections) {
    const connection = await connectionSecret(item.id, projectId);
    for (const repository of item.repositories) {
      try {
        const webhookExternalId = await installProviderWebhook(
          providerInput(connection),
          {
            externalId: repository.externalId,
            fullName: repository.fullName,
            webUrl: repository.webUrl,
            private: false,
          },
          payloadUrl,
          settings.secret,
        );
        await db
          .update(gitManagedRepository)
          .set({ webhookExternalId, status: 'connected', lastError: null, updatedAt: new Date() })
          .where(eq(gitManagedRepository.id, repository.id));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Webhook update failed';
        await db
          .update(gitManagedRepository)
          .set({ status: 'error', lastError: message, updatedAt: new Date() })
          .where(eq(gitManagedRepository.id, repository.id));
      }
    }
  }
}

export async function postPullRequestLinkback(
  projectId: number,
  provider: GitProvider,
  repository: string,
  number: number,
  body: string,
): Promise<boolean> {
  const [row] = await db
    .select({
      provider: gitProviderConnection.provider,
      baseUrl: gitProviderConnection.baseUrl,
      ciphertext: gitProviderConnection.ciphertext,
      iv: gitProviderConnection.iv,
      authTag: gitProviderConnection.authTag,
      externalId: gitManagedRepository.externalId,
      fullName: gitManagedRepository.fullName,
      webUrl: gitManagedRepository.webUrl,
    })
    .from(gitManagedRepository)
    .innerJoin(
      gitProviderConnection,
      eq(gitManagedRepository.connectionId, gitProviderConnection.id),
    )
    .where(
      and(
        eq(gitProviderConnection.projectId, projectId),
        eq(gitProviderConnection.provider, provider),
        eq(gitManagedRepository.fullName, repository),
      ),
    )
    .limit(1);
  if (!row) return false;
  await createPullRequestComment(
    {
      provider,
      baseUrl: row.baseUrl,
      token: decryptSecret(row),
    },
    {
      externalId: row.externalId,
      fullName: row.fullName,
      webUrl: row.webUrl,
      private: false,
    },
    number,
    body,
  );
  return true;
}
