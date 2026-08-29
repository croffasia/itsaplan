import { t } from 'elysia';

export const webhookParams = t.Object({ webhookId: t.String() });

export const webhookBody = t.String();

export const WebhookAckResponse = t.Object({ ok: t.Boolean(), handled: t.String() });

// The repository integration DTO (GitSettings from the service). Unlike outgoing
// webhook secrets, this secret authorizes issue moves through the receiver, so
// it is shown only to members with integrations edit access; read-only callers
// get null.
export const GitSettingsResponse = t.Object({
  enabled: t.Boolean(),
  webhookId: t.String(),
  secret: t.Nullable(t.String()),
  onMergeColumnId: t.Nullable(t.Number()),
  onOpenColumnId: t.Nullable(t.Number()),
  repositories: t.Array(
    t.Object({ repo: t.String(), provider: t.String(), lastEventAt: t.String() }),
  ),
});

export const updateGitSettingsBody = t.Object({
  enabled: t.Optional(t.Boolean()),
  onMergeColumnId: t.Optional(t.Nullable(t.Number())),
  onOpenColumnId: t.Optional(t.Nullable(t.Number())),
});

export const GitProvider = t.Union([t.Literal('github'), t.Literal('gitlab')]);

export const GitManagedRepositoryResponse = t.Object({
  id: t.Number(),
  externalId: t.String(),
  fullName: t.String(),
  webUrl: t.String(),
  status: t.Union([t.Literal('connected'), t.Literal('error')]),
  lastError: t.Nullable(t.String()),
});

export const GitProviderConnectionResponse = t.Object({
  id: t.Number(),
  provider: GitProvider,
  baseUrl: t.String(),
  accountLogin: t.String(),
  repositories: t.Array(GitManagedRepositoryResponse),
  createdAt: t.String(),
  updatedAt: t.String(),
});

export const GitProviderConnectionListResponse = t.Array(GitProviderConnectionResponse);

export const createGitProviderConnectionBody = t.Object({
  provider: GitProvider,
  baseUrl: t.Optional(t.String({ maxLength: 2048 })),
  token: t.String({ minLength: 1, maxLength: 8192 }),
});

export const gitProviderConnectionParams = t.Object({
  projectKey: t.String(),
  connectionId: t.Numeric(),
});

export const gitManagedRepositoryParams = t.Object({
  projectKey: t.String(),
  connectionId: t.Numeric(),
  repositoryId: t.Numeric(),
});

export const availableRepositoriesQuery = t.Object({
  page: t.Optional(t.Numeric({ minimum: 1 })),
  search: t.Optional(t.String({ maxLength: 200 })),
});

export const AvailableGitRepositoryResponse = t.Object({
  externalId: t.String(),
  fullName: t.String(),
  webUrl: t.String(),
  private: t.Boolean(),
  managedRepositoryId: t.Nullable(t.Number()),
});

export const AvailableGitRepositoryPageResponse = t.Object({
  repositories: t.Array(AvailableGitRepositoryResponse),
  nextPage: t.Nullable(t.Number()),
});

export const connectRepositoriesBody = t.Object({
  externalIds: t.Array(t.String({ minLength: 1, maxLength: 200 }), {
    minItems: 1,
    maxItems: 50,
  }),
});
