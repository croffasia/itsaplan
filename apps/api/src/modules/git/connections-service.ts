import { db, gitManagedRepository, gitProviderConnection, project } from '@repo/db';
import { decryptSecret, encryptSecret } from '@repo/crypto';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { HttpError, iso } from '#shared/lib';
import {
  GithubAppRefusedError,
  getGithubAppInstallation,
  githubInstallationToken,
} from './github-app';
import {
  apiBase,
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
  type GitAuthType,
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
  authType: GitAuthType;
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

type ConnectionRow = Pick<
  typeof gitProviderConnection.$inferSelect,
  'baseUrl' | 'authType' | 'appId' | 'installationId' | 'ciphertext' | 'iv' | 'authTag'
>;

async function connectionInput<P extends GitProvider>(
  row: ConnectionRow,
  provider: P,
  { fresh = false }: { fresh?: boolean } = {},
): Promise<ProviderConnectionInput & { provider: P }> {
  if (row.authType !== 'github_app') {
    return { provider, baseUrl: row.baseUrl, token: decryptSecret(row), authType: 'token' };
  }
  if (!row.appId || !row.installationId) {
    throw new HttpError(500, 'GitHub App connection is incomplete');
  }
  const token = await githubInstallationToken(
    {
      apiBase: apiBase('github', row.baseUrl),
      appId: row.appId,
      installationId: row.installationId,
      privateKey: decryptSecret(row),
    },
    { fresh },
  );
  return { provider, baseUrl: row.baseUrl, token, authType: 'github_app' };
}

const connectionColumns = {
  provider: gitProviderConnection.provider,
  baseUrl: gitProviderConnection.baseUrl,
  authType: gitProviderConnection.authType,
  appId: gitProviderConnection.appId,
  installationId: gitProviderConnection.installationId,
  ciphertext: gitProviderConnection.ciphertext,
  iv: gitProviderConnection.iv,
  authTag: gitProviderConnection.authTag,
};

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
      ...connectionColumns,
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
        eq(gitManagedRepository.projectId, projectId),
        eq(gitManagedRepository.status, 'connected'),
      ),
    )
    .limit(1);
  if (!row) throw new HttpError(404, 'Managed repository not found');
  if (row.provider !== 'github' && row.provider !== 'gitlab')
    throw new HttpError(400, 'Creating and linking pull requests supports GitHub and GitLab');
  return {
    input: await connectionInput(row, row.provider),
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
        eq(gitManagedRepository.projectId, projectId),
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
  projectId: number | undefined,
  connectionIds: number[],
): Promise<Map<number, GitManagedRepositoryDto[]>> {
  if (connectionIds.length === 0) return new Map();
  const rows = await db
    .select({ connectionId: gitManagedRepository.connectionId, ...repositoryColumns })
    .from(gitManagedRepository)
    .where(
      projectId === undefined
        ? inArray(gitManagedRepository.connectionId, connectionIds)
        : and(
            eq(gitManagedRepository.projectId, projectId),
            inArray(gitManagedRepository.connectionId, connectionIds),
          ),
    )
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
  const teamId = await projectTeamId(projectId);
  return listTeamGitProviderConnections(teamId, projectId);
}

async function projectTeamId(projectId: number): Promise<number> {
  const [row] = await db
    .select({ teamId: project.teamId })
    .from(project)
    .where(eq(project.id, projectId))
    .limit(1);
  if (!row) throw new HttpError(404, 'Project not found');
  return row.teamId;
}

export async function listTeamGitProviderConnections(
  teamId: number,
  projectId?: number,
): Promise<GitProviderConnectionDto[]> {
  const rows = await db
    .select({
      id: gitProviderConnection.id,
      provider: gitProviderConnection.provider,
      authType: gitProviderConnection.authType,
      baseUrl: gitProviderConnection.baseUrl,
      accountLogin: gitProviderConnection.accountLogin,
      createdAt: gitProviderConnection.createdAt,
      updatedAt: gitProviderConnection.updatedAt,
    })
    .from(gitProviderConnection)
    .where(eq(gitProviderConnection.teamId, teamId))
    .orderBy(asc(gitProviderConnection.provider), asc(gitProviderConnection.baseUrl));
  const repositories = await repositoriesByConnection(
    projectId,
    rows.map((row) => row.id),
  );
  return rows.map((row) => ({
    id: row.id,
    provider: row.provider as GitProvider,
    authType: row.authType as GitAuthType,
    baseUrl: row.baseUrl,
    accountLogin: row.accountLogin,
    repositories: repositories.get(row.id) ?? [],
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  }));
}

async function connectionInputForProject(
  id: number,
  projectId: number,
): Promise<ProviderConnectionInput> {
  const row = await teamConnectionRow(id, await projectTeamId(projectId));
  return connectionInput(row, row.provider);
}

async function teamConnectionRow(id: number, teamId: number) {
  const rows = await db
    .select()
    .from(gitProviderConnection)
    .where(and(eq(gitProviderConnection.id, id), eq(gitProviderConnection.teamId, teamId)))
    .limit(1);
  const row = rows[0];
  if (!row) throw new HttpError(404, 'Provider connection not found');
  if (!['github', 'gitlab', 'gitea', 'forgejo', 'bitbucket'].includes(row.provider)) {
    throw new HttpError(400, 'Unknown Git provider');
  }
  return { ...row, provider: row.provider as GitProvider };
}

export async function connectGitProvider(
  teamId: number,
  input: { provider: GitProvider; baseUrl?: string; token: string },
): Promise<GitProviderConnectionDto> {
  const token = input.token.trim();
  if (!token) throw new HttpError(400, 'token is required');
  const baseUrl = await normalizeProviderBaseUrl(input.provider, input.baseUrl);
  const accountLogin = await getProviderAccount({
    provider: input.provider,
    baseUrl,
    token,
    authType: 'token',
  });
  const encrypted = encryptSecret(token);
  // A team can hold several connections of one account: the migration from
  // project-owned connections keeps each project's token. Saving the account
  // rotates all of them.
  let rows = await db
    .update(gitProviderConnection)
    .set({ ...encrypted, updatedAt: new Date() })
    .where(
      and(
        eq(gitProviderConnection.teamId, teamId),
        eq(gitProviderConnection.provider, input.provider),
        eq(gitProviderConnection.baseUrl, baseUrl),
        eq(gitProviderConnection.authType, 'token'),
        eq(gitProviderConnection.accountLogin, accountLogin),
      ),
    )
    .returning({ id: gitProviderConnection.id });
  if (rows.length === 0) {
    rows = await db
      .insert(gitProviderConnection)
      .values({ teamId, provider: input.provider, baseUrl, accountLogin, ...encrypted })
      .returning({ id: gitProviderConnection.id });
  }
  return reconcileStoredConnection(teamId, rows, {
    provider: input.provider,
    baseUrl,
    token,
    authType: 'token',
  });
}

export async function connectGithubApp(
  teamId: number,
  input: { baseUrl?: string; appId: string; installationId: string; privateKey: string },
): Promise<GitProviderConnectionDto> {
  const privateKey = input.privateKey.trim();
  const baseUrl = await normalizeProviderBaseUrl('github', input.baseUrl);
  const app = {
    apiBase: apiBase('github', baseUrl),
    appId: input.appId,
    installationId: input.installationId,
    privateKey,
  };
  const { accountLogin } = await getGithubAppInstallation(app);
  const token = await githubInstallationToken(app);
  const encrypted = encryptSecret(privateKey);
  let rows = await db
    .update(gitProviderConnection)
    .set({ ...encrypted, appId: input.appId, accountLogin, updatedAt: new Date() })
    .where(
      and(
        eq(gitProviderConnection.teamId, teamId),
        eq(gitProviderConnection.provider, 'github'),
        eq(gitProviderConnection.baseUrl, baseUrl),
        eq(gitProviderConnection.authType, 'github_app'),
        eq(gitProviderConnection.installationId, input.installationId),
      ),
    )
    .returning({ id: gitProviderConnection.id });
  if (rows.length === 0) {
    rows = await db
      .insert(gitProviderConnection)
      .values({
        teamId,
        provider: 'github',
        baseUrl,
        accountLogin,
        authType: 'github_app',
        appId: input.appId,
        installationId: input.installationId,
        ...encrypted,
      })
      .returning({ id: gitProviderConnection.id });
  }
  return reconcileStoredConnection(teamId, rows, {
    provider: 'github',
    baseUrl,
    token,
    authType: 'github_app',
  });
}

async function reconcileStoredConnection(
  teamId: number,
  rows: { id: number }[],
  input: ProviderConnectionInput,
): Promise<GitProviderConnectionDto> {
  const connectionId = rows[0]?.id;
  if (!connectionId) throw new HttpError(500, 'Provider connection was not stored');
  for (const row of rows) await reconcileConnectionWebhooks(row.id, input);
  const connections = await listTeamGitProviderConnections(teamId);
  const connection = connections.find((item) => item.id === connectionId);
  if (!connection) throw new HttpError(500, 'Provider connection was not stored');
  return connection;
}

async function reconcileConnectionWebhooks(
  connectionId: number,
  input: ProviderConnectionInput,
): Promise<void> {
  const repositories = await db
    .select()
    .from(gitManagedRepository)
    .where(eq(gitManagedRepository.connectionId, connectionId));
  const settingsByProject = new Map<number, GitSettings>();
  for (const repository of repositories) {
    let settings = settingsByProject.get(repository.projectId);
    if (!settings) {
      settings = await getOrCreateGitSettings(repository.projectId);
      settingsByProject.set(repository.projectId, settings);
    }
    await reconcileRepositoryWebhook(input, repository, settings);
  }
}

async function reconcileRepositoryWebhook(
  input: ProviderConnectionInput,
  repository: typeof gitManagedRepository.$inferSelect,
  settings: GitSettings,
): Promise<void> {
  try {
    const webhookExternalId = await installProviderWebhook(
      input,
      {
        externalId: repository.externalId,
        fullName: repository.fullName,
        webUrl: repository.webUrl,
        private: false,
      },
      settings.payloadUrl,
      settings.secret,
      repository.webhookExternalId,
    );
    await db
      .update(gitManagedRepository)
      .set({ webhookExternalId, status: 'connected', lastError: null, updatedAt: new Date() })
      .where(eq(gitManagedRepository.id, repository.id));
  } catch (error) {
    await markRepositoryFailed(repository.id, error);
  }
}

async function markRepositoryFailed(repositoryId: number, error: unknown): Promise<void> {
  await db
    .update(gitManagedRepository)
    .set({
      status: 'error',
      lastError: error instanceof Error ? error.message : 'Webhook update failed',
      updatedAt: new Date(),
    })
    .where(eq(gitManagedRepository.id, repositoryId));
}

export async function listAvailableRepositories(
  projectId: number,
  connectionId: number,
  page: number,
  search: string,
) {
  const input = await connectionInputForProject(connectionId, projectId);
  const result = await listProviderRepositories(input, page, search.trim());
  const managed = await db
    .select({ id: gitManagedRepository.id, externalId: gitManagedRepository.externalId })
    .from(gitManagedRepository)
    .where(
      and(
        eq(gitManagedRepository.projectId, projectId),
        eq(gitManagedRepository.connectionId, connectionId),
      ),
    );
  const managedByExternalId = new Map(managed.map((repo) => [repo.externalId, repo.id]));
  return {
    repositories: result.repositories.map((repo) => ({
      ...repo,
      managedRepositoryId: managedByExternalId.get(repo.externalId) ?? null,
    })),
    nextPage: result.nextPage,
  };
}

export async function connectRepositories(
  projectId: number,
  connectionId: number,
  externalIds: string[],
): Promise<GitProviderConnectionDto> {
  const ids = [...new Set(externalIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) throw new HttpError(400, 'Select at least one repository');
  if (ids.length > 50) throw new HttpError(400, 'Select at most 50 repositories');
  const input = await connectionInputForProject(connectionId, projectId);
  const existing = await db
    .select({ externalId: gitManagedRepository.externalId })
    .from(gitManagedRepository)
    .where(
      and(
        eq(gitManagedRepository.connectionId, connectionId),
        eq(gitManagedRepository.projectId, projectId),
        inArray(gitManagedRepository.externalId, ids),
      ),
    );
  const existingIds = new Set(existing.map((repo) => repo.externalId));
  const settings = await getOrCreateGitSettings(projectId);
  for (const externalId of ids) {
    if (existingIds.has(externalId)) continue;
    const repository = await getProviderRepository(input, externalId);
    const webhookExternalId = await installProviderWebhook(
      input,
      repository,
      settings.payloadUrl,
      settings.secret,
      null,
    );
    await db.insert(gitManagedRepository).values({
      projectId,
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
  const input = await connectionInputForProject(connectionId, projectId);
  const rows = await db
    .select()
    .from(gitManagedRepository)
    .where(
      and(
        eq(gitManagedRepository.id, repositoryId),
        eq(gitManagedRepository.connectionId, connectionId),
        eq(gitManagedRepository.projectId, projectId),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) throw new HttpError(404, 'Managed repository not found');
  await deleteProviderWebhook(
    input,
    { externalId: row.externalId, fullName: row.fullName, webUrl: row.webUrl, private: false },
    row.webhookExternalId,
  );
  await db.delete(gitManagedRepository).where(eq(gitManagedRepository.id, repositoryId));
}

export async function disconnectGitProvider(teamId: number, connectionId: number): Promise<void> {
  const row = await teamConnectionRow(connectionId, teamId);
  // A fresh mint shows whether GitHub still accepts the App: only a refusal lets the
  // connection go without removing its webhooks. Any other failure keeps it for a retry.
  const input = await connectionInput(row, row.provider, { fresh: true }).catch(
    (error: unknown) => {
      if (error instanceof GithubAppRefusedError) return null;
      throw error;
    },
  );
  if (input) {
    const repositories = await db
      .select()
      .from(gitManagedRepository)
      .where(eq(gitManagedRepository.connectionId, connectionId));
    for (const repository of repositories) {
      await deleteProviderWebhook(
        input,
        {
          externalId: repository.externalId,
          fullName: repository.fullName,
          webUrl: repository.webUrl,
          private: false,
        },
        repository.webhookExternalId,
      );
    }
  }
  await db
    .delete(gitProviderConnection)
    .where(
      and(eq(gitProviderConnection.id, connectionId), eq(gitProviderConnection.teamId, teamId)),
    );
}

export async function reconcileManagedWebhooks(
  projectId: number,
  settings: GitSettings,
): Promise<void> {
  const connections = await listGitProviderConnections(projectId);
  for (const item of connections) {
    const repositories = await db
      .select()
      .from(gitManagedRepository)
      .where(
        and(
          eq(gitManagedRepository.projectId, projectId),
          eq(gitManagedRepository.connectionId, item.id),
        ),
      );
    let input: ProviderConnectionInput;
    try {
      input = await connectionInputForProject(item.id, projectId);
    } catch (error) {
      // The new secret is already stored: a connection whose credentials are refused
      // must not leave the webhooks of the connections after it on the old one.
      for (const repository of repositories) await markRepositoryFailed(repository.id, error);
      continue;
    }
    for (const repository of repositories) {
      await reconcileRepositoryWebhook(input, repository, settings);
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
      ...connectionColumns,
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
        eq(gitManagedRepository.projectId, projectId),
        eq(gitProviderConnection.provider, provider),
        eq(gitManagedRepository.fullName, repository),
      ),
    )
    .limit(1);
  if (!row) return false;
  await createPullRequestComment(
    await connectionInput(row, provider),
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
