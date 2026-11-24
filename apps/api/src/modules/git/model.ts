import { t } from 'elysia';

export const webhookParams = t.Object({ webhookId: t.String() });

export const webhookBody = t.String();

export const WebhookAckResponse = t.Object({ ok: t.Boolean(), handled: t.String() });

export const DevelopmentRepositoryResponse = t.Object({
  id: t.Number(),
  provider: t.Union([
    t.Literal('github'),
    t.Literal('gitlab'),
    t.Literal('gitea'),
    t.Literal('forgejo'),
  ]),
  baseUrl: t.String({
    description: 'Address of the provider instance, such as https://github.com.',
  }),
  fullName: t.String({ description: "The repository's path on its provider, such as owner/name." }),
  webUrl: t.String(),
});

const PipelineStatusResponse = t.Union([
  t.Literal('pending'),
  t.Literal('running'),
  t.Literal('success'),
  t.Literal('failed'),
  t.Literal('canceled'),
  t.Literal('skipped'),
]);

const DevelopmentCheckResponse = t.Object({
  id: t.Number(),
  name: t.String(),
  status: PipelineStatusResponse,
  url: t.Nullable(t.String()),
  updatedAt: t.String(),
});

export const DevelopmentLinkResponse = t.Object({
  id: t.Number(),
  provider: t.Union([
    t.Literal('github'),
    t.Literal('gitlab'),
    t.Literal('gitea'),
    t.Literal('forgejo'),
    t.Literal('bitbucket'),
  ]),
  repository: t.String(),
  kind: t.Union([t.Literal('pull_request'), t.Literal('branch')]),
  number: t.Nullable(t.Number()),
  title: t.String(),
  url: t.Nullable(t.String()),
  state: t.Union([t.Literal('open'), t.Literal('merged'), t.Literal('closed')]),
  draft: t.Boolean(),
  sourceBranch: t.Nullable(t.String()),
  targetBranch: t.String(),
  headSha: t.Nullable(t.String()),
  pipelineStatus: t.Nullable(PipelineStatusResponse),
  pipelineUrl: t.Nullable(t.String()),
  checkStatus: t.Nullable(PipelineStatusResponse),
  checks: t.Array(DevelopmentCheckResponse),
  updatedAt: t.String(),
});

// The repository integration DTO (GitSettings from the service).
export const GitSettingsResponse = t.Object({
  enabled: t.Boolean(),
  webhookId: t.String(),
  payloadUrl: t.String(),
  secret: t.String(),
  onMergeColumnId: t.Nullable(t.Number()),
  onOpenColumnId: t.Nullable(t.Number()),
  linkbackComments: t.Boolean(),
  repositories: t.Array(
    t.Object({ repo: t.String(), provider: t.String(), lastEventAt: t.String() }),
  ),
});

export const updateGitSettingsBody = t.Object({
  enabled: t.Optional(t.Boolean()),
  onMergeColumnId: t.Optional(t.Nullable(t.Number())),
  onOpenColumnId: t.Optional(t.Nullable(t.Number())),
  linkbackComments: t.Optional(t.Boolean()),
});

export const GitProvider = t.Union([
  t.Literal('github'),
  t.Literal('gitlab'),
  t.Literal('gitea'),
  t.Literal('forgejo'),
  t.Literal('bitbucket'),
]);

const IssueSyncMode = t.Union([t.Literal('off'), t.Literal('one_way'), t.Literal('two_way')], {
  description:
    "'one_way': new repository issues become issues and a status change here closes or " +
    "reopens them. 'two_way': changes of a linked repository issue also come back.",
});

export const GitManagedRepositoryResponse = t.Object({
  id: t.Number(),
  externalId: t.String(),
  fullName: t.String(),
  webUrl: t.String(),
  status: t.Union([t.Literal('connected'), t.Literal('error')]),
  lastError: t.Nullable(t.String()),
  issueSync: IssueSyncMode,
  issueColumnId: t.Nullable(t.Number({ description: 'Null puts new issues in the first column.' })),
  issueComments: t.Boolean(),
});

const RepositoryLabelMapping = t.Object({
  externalName: t.String({ minLength: 1, maxLength: 200 }),
  labelId: t.Nullable(t.Number()),
  typeId: t.Nullable(t.Number()),
});

export const updateManagedRepositoryBody = t.Object({
  issueSync: t.Optional(IssueSyncMode),
  issueColumnId: t.Optional(t.Nullable(t.Number())),
  issueComments: t.Optional(t.Boolean()),
  labelMappings: t.Optional(t.Array(RepositoryLabelMapping, { maxItems: 500 })),
});

export const RepositoryMappingResponse = t.Object({
  labels: t.Array(t.Object({ name: t.String(), color: t.Nullable(t.String()) })),
  labelMappings: t.Array(RepositoryLabelMapping),
});

export const importRepositoryIssuesBody = t.Object({
  page: t.Optional(t.Number({ minimum: 1 })),
});

export const ImportRepositoryIssuesResponse = t.Object({
  created: t.Number(),
  skipped: t.Number(),
  nextPage: t.Nullable(t.Number()),
});

export const LinkedRepositoryIssueResponse = t.Object({
  provider: GitProvider,
  repository: t.String(),
  number: t.Number(),
  url: t.Nullable(t.String()),
  state: t.Union([t.Literal('open'), t.Literal('closed')]),
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

export const teamGitProviderConnectionParams = t.Object({
  teamId: t.Numeric(),
  connectionId: t.Numeric(),
});

export const gitManagedRepositoryParams = t.Object({
  projectKey: t.String(),
  connectionId: t.Numeric(),
  repositoryId: t.Numeric(),
});

export const managedRepositoryParams = t.Object({
  projectKey: t.String(),
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
