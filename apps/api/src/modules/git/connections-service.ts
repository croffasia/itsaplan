import {
  db,
  gitManagedRepository,
  gitProviderConnection,
  gitRepositoryLabel,
  project,
} from '@repo/db';
import { decryptSecret, encryptSecret, type EncryptedSecret } from '@repo/crypto';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { HttpError, iso } from '#shared/lib';
import {
  createProviderPullRequest,
  deleteProviderWebhook,
  createPullRequestComment,
  DEVELOPMENT_PROVIDERS,
  resolveLinkProvider,
  ensureDevelopmentProvider,
  getProviderAccount,
  getProviderPullRequest,
  getProviderRepository,
  installProviderWebhook,
  listProviderBranches,
  listProviderLabels,
  listProviderPullRequests,
  listProviderRepositories,
  type ProviderLabel,
  normalizeProviderBaseUrl,
  type CreateProviderPullRequestInput,
  type DevelopmentProvider,
  type GitProvider,
  type ProviderBranchPage,
  type ProviderConnectionInput,
  type ProviderPullRequestDetails,
  type ProviderPullRequestPage,
  type ProviderRepository,
} from './connections-provider';
import { assertProjectColumn, getOrCreateGitSettings, type GitSettings } from './service';
import { assertIssueLabels, assertIssueType } from '#modules/issues/service';

export interface GitProviderConnectionDto {
  id: number;
  provider: GitProvider;
  baseUrl: string;
  accountLogin: string;
  repositories: GitManagedRepositoryDto[];
  createdAt: string;
  updatedAt: string;
}

export type IssueSyncMode = 'off' | 'one_way' | 'two_way';

export interface GitManagedRepositoryDto {
  id: number;
  externalId: string;
  fullName: string;
  webUrl: string;
  status: 'connected' | 'error';
  lastError: string | null;
  issueSync: IssueSyncMode;
  issueColumnId: number | null;
  issueComments: boolean;
}

export interface RepositoryLabelMapping {
  externalName: string;
  labelId: number | null;
  typeId: number | null;
}

export interface DevelopmentRepositoryDto {
  id: number;
  provider: DevelopmentProvider;
  baseUrl: string;
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
  issueSync: gitManagedRepository.issueSync,
  issueColumnId: gitManagedRepository.issueColumnId,
  issueComments: gitManagedRepository.issueComments,
};

function mapRepository(row: {
  id: number;
  externalId: string;
  fullName: string;
  webUrl: string;
  status: string;
  lastError: string | null;
  issueSync: string;
  issueColumnId: number | null;
  issueComments: boolean;
}): GitManagedRepositoryDto {
  return {
    ...row,
    status: row.status === 'error' ? 'error' : 'connected',
    issueSync: (['one_way', 'two_way'] as const).find((mode) => mode === row.issueSync) ?? 'off',
  };
}

interface ManagedDevelopmentRepository {
  input: ProviderConnectionInput & { provider: DevelopmentProvider };
  repository: ProviderRepository;
}

// What a call to a repository's provider reads: the connection's token and the repository.
export const providerCallColumns = {
  provider: gitProviderConnection.provider,
  baseUrl: gitProviderConnection.baseUrl,
  ciphertext: gitProviderConnection.ciphertext,
  iv: gitProviderConnection.iv,
  authTag: gitProviderConnection.authTag,
  externalId: gitManagedRepository.externalId,
  fullName: gitManagedRepository.fullName,
  webUrl: gitManagedRepository.webUrl,
};

export function providerCallArgs(
  row: EncryptedSecret & {
    provider: string;
    baseUrl: string;
    externalId: string;
    fullName: string;
    webUrl: string;
  },
): { input: ProviderConnectionInput; repository: ProviderRepository } {
  return {
    input: {
      provider: row.provider as GitProvider,
      baseUrl: row.baseUrl,
      token: decryptSecret(row),
    },
    repository: {
      externalId: row.externalId,
      fullName: row.fullName,
      webUrl: row.webUrl,
      private: false,
    },
  };
}

async function managedDevelopmentRepository(
  projectId: number,
  repositoryId: number,
): Promise<ManagedDevelopmentRepository> {
  const [row] = await db
    .select(providerCallColumns)
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
  ensureDevelopmentProvider(row.provider);
  const { input, repository } = providerCallArgs(row);
  return { input: { ...input, provider: row.provider }, repository };
}

export async function listDevelopmentRepositories(
  projectId: number,
): Promise<DevelopmentRepositoryDto[]> {
  const rows = await db
    .select({
      id: gitManagedRepository.id,
      provider: gitProviderConnection.provider,
      baseUrl: gitProviderConnection.baseUrl,
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
        inArray(gitProviderConnection.provider, [...DEVELOPMENT_PROVIDERS]),
      ),
    )
    .orderBy(asc(gitProviderConnection.provider), asc(gitManagedRepository.fullName));
  return rows.map((row) => ({ ...row, provider: row.provider as DevelopmentProvider }));
}

export async function listManagedPullRequests(
  projectId: number,
  repositoryId: number,
  state: 'open' | 'all',
  page: number,
): Promise<{
  provider: DevelopmentProvider;
  repository: string;
  page: ProviderPullRequestPage;
}> {
  const managed = await managedDevelopmentRepository(projectId, repositoryId);
  const [provider, pullRequests] = await Promise.all([
    resolveLinkProvider(managed.input),
    listProviderPullRequests(managed.input, managed.repository, state, page),
  ]);
  return { provider, repository: managed.repository.fullName, page: pullRequests };
}

export async function getManagedPullRequest(
  projectId: number,
  repositoryId: number,
  number: number,
): Promise<{ provider: DevelopmentProvider; details: ProviderPullRequestDetails }> {
  const managed = await managedDevelopmentRepository(projectId, repositoryId);
  const [provider, details] = await Promise.all([
    resolveLinkProvider(managed.input),
    getProviderPullRequest(managed.input, managed.repository, number),
  ]);
  return { provider, details };
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
): Promise<{ provider: DevelopmentProvider; details: ProviderPullRequestDetails }> {
  const managed = await managedDevelopmentRepository(projectId, repositoryId);
  // Resolved before the pull request exists, so a failure here leaves nothing unlinked.
  const provider = await resolveLinkProvider(managed.input);
  return {
    provider,
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
    baseUrl: row.baseUrl,
    accountLogin: row.accountLogin,
    repositories: repositories.get(row.id) ?? [],
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  }));
}

async function connectionSecret(id: number, projectId: number): Promise<ConnectionSecret> {
  return teamConnectionSecret(id, await projectTeamId(projectId));
}

async function teamConnectionSecret(id: number, teamId: number): Promise<ConnectionSecret> {
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
  teamId: number,
  input: { provider: GitProvider; baseUrl?: string; token: string },
): Promise<GitProviderConnectionDto> {
  const token = input.token.trim();
  if (!token) throw new HttpError(400, 'token is required');
  const baseUrl = await normalizeProviderBaseUrl(input.provider, input.baseUrl);
  const accountLogin = await getProviderAccount({ provider: input.provider, baseUrl, token });
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
  const connectionId = rows[0]?.id;
  if (!connectionId) throw new HttpError(500, 'Provider connection was not stored');
  for (const row of rows) {
    await reconcileConnectionWebhooks(row.id, { provider: input.provider, baseUrl, token });
  }
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
      repository.issueSync !== 'off',
    );
    await db
      .update(gitManagedRepository)
      .set({ webhookExternalId, status: 'connected', lastError: null, updatedAt: new Date() })
      .where(eq(gitManagedRepository.id, repository.id));
  } catch (error) {
    await db
      .update(gitManagedRepository)
      .set({
        status: 'error',
        lastError: error instanceof Error ? error.message : 'Webhook update failed',
        updatedAt: new Date(),
      })
      .where(eq(gitManagedRepository.id, repository.id));
  }
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
  const connection = await connectionSecret(connectionId, projectId);
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
    const repository = await getProviderRepository(providerInput(connection), externalId);
    const webhookExternalId = await installProviderWebhook(
      providerInput(connection),
      repository,
      settings.payloadUrl,
      settings.secret,
      null,
      false,
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
  const connection = await connectionSecret(connectionId, projectId);
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
    providerInput(connection),
    { externalId: row.externalId, fullName: row.fullName, webUrl: row.webUrl, private: false },
    row.webhookExternalId,
  );
  await db.delete(gitManagedRepository).where(eq(gitManagedRepository.id, repositoryId));
}

export async function disconnectGitProvider(teamId: number, connectionId: number): Promise<void> {
  const connection = await teamConnectionSecret(connectionId, teamId);
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
      and(eq(gitProviderConnection.id, connectionId), eq(gitProviderConnection.teamId, teamId)),
    );
}

export async function reconcileManagedWebhooks(
  projectId: number,
  settings: GitSettings,
): Promise<void> {
  const connections = await listGitProviderConnections(projectId);
  for (const item of connections) {
    const input = providerInput(await connectionSecret(item.id, projectId));
    const repositories = await db
      .select()
      .from(gitManagedRepository)
      .where(
        and(
          eq(gitManagedRepository.projectId, projectId),
          eq(gitManagedRepository.connectionId, item.id),
        ),
      );
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
    .select(providerCallColumns)
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
  const call = providerCallArgs(row);
  await createPullRequestComment(call.input, call.repository, number, body);
  return true;
}

// A row whose label or type was deleted in the project is left pointing at nothing.
function mapsToSomething(mapping: RepositoryLabelMapping): boolean {
  return mapping.labelId != null || mapping.typeId != null;
}

// The repository's labels and what each one becomes here. A mapped label the
// repository has since deleted stays listed, so it can be unmapped.
export async function getRepositoryMapping(
  projectId: number,
  repositoryId: number,
): Promise<{
  labels: ProviderLabel[];
  labelMappings: RepositoryLabelMapping[];
}> {
  const managed = await managedDevelopmentRepository(projectId, repositoryId);
  const [labels, labelMappings] = await Promise.all([
    listProviderLabels(managed.input, managed.repository),
    db
      .select({
        externalName: gitRepositoryLabel.externalName,
        labelId: gitRepositoryLabel.labelId,
        typeId: gitRepositoryLabel.typeId,
      })
      .from(gitRepositoryLabel)
      .where(eq(gitRepositoryLabel.repositoryId, repositoryId)),
  ]);
  const labelNames = new Set(labels.map((label) => label.name));
  const goneLabels = labelMappings
    .filter((mapping) => !labelNames.has(mapping.externalName))
    .map((mapping) => ({ name: mapping.externalName, color: null }));
  return {
    labels: [...labels, ...goneLabels].sort((a, b) => a.name.localeCompare(b.name)),
    labelMappings: labelMappings.filter(mapsToSomething),
  };
}

export async function updateManagedRepository(
  projectId: number,
  repositoryId: number,
  patch: {
    issueSync?: IssueSyncMode;
    issueColumnId?: number | null;
    issueComments?: boolean;
    labelMappings?: RepositoryLabelMapping[];
  },
): Promise<GitManagedRepositoryDto> {
  const [row] = await db
    .select({ repository: gitManagedRepository, provider: gitProviderConnection.provider })
    .from(gitManagedRepository)
    .innerJoin(
      gitProviderConnection,
      eq(gitManagedRepository.connectionId, gitProviderConnection.id),
    )
    .where(
      and(eq(gitManagedRepository.id, repositoryId), eq(gitManagedRepository.projectId, projectId)),
    )
    .limit(1);
  if (!row) throw new HttpError(404, 'Managed repository not found');
  const issuesOn = (mode: string) => mode !== 'off';
  if (
    patch.issueSync &&
    issuesOn(patch.issueSync) &&
    !(DEVELOPMENT_PROVIDERS as readonly string[]).includes(row.provider)
  )
    throw new HttpError(400, 'Bitbucket repositories cannot sync issues');
  await assertProjectColumn(projectId, patch.issueColumnId);
  const labelMappings = patch.labelMappings?.filter(mapsToSomething);
  if (labelMappings) {
    await assertIssueLabels(
      projectId,
      labelMappings.flatMap((mapping) => (mapping.labelId == null ? [] : [mapping.labelId])),
    );
    for (const mapping of labelMappings) await assertIssueType(projectId, mapping.typeId);
  }

  const fields: Partial<typeof gitManagedRepository.$inferInsert> = {};
  if (patch.issueSync !== undefined) fields.issueSync = patch.issueSync;
  if (patch.issueColumnId !== undefined) fields.issueColumnId = patch.issueColumnId;
  if (patch.issueComments !== undefined) fields.issueComments = patch.issueComments;
  const [updated] = await db
    .update(gitManagedRepository)
    .set({ ...fields, updatedAt: new Date() })
    .where(eq(gitManagedRepository.id, repositoryId))
    .returning();
  if (labelMappings) {
    // One mapping per repository label: the last mapping of a name wins.
    const byName = new Map(labelMappings.map((mapping) => [mapping.externalName, mapping]));
    await db.transaction(async (tx) => {
      await tx.delete(gitRepositoryLabel).where(eq(gitRepositoryLabel.repositoryId, repositoryId));
      if (byName.size > 0)
        await tx
          .insert(gitRepositoryLabel)
          .values([...byName.values()].map((mapping) => ({ repositoryId, ...mapping })));
    });
  }
  // The webhook carries issue events only while the sync is on.
  if (updated && issuesOn(updated.issueSync) !== issuesOn(row.repository.issueSync)) {
    const connection = await connectionSecret(updated.connectionId, projectId);
    await reconcileRepositoryWebhook(
      providerInput(connection),
      updated,
      await getOrCreateGitSettings(projectId),
    );
  }
  const [current] = await db
    .select(repositoryColumns)
    .from(gitManagedRepository)
    .where(eq(gitManagedRepository.id, repositoryId));
  return mapRepository(current!);
}
