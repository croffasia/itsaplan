import { HttpError } from '#shared/lib';
import { assertPublicHttpUrl, pinnedFetch } from '#shared/net';
import {
  PROVIDER_LABEL,
  githubIssueSnapshot,
  gitlabIssueSnapshot,
  pipelineStatus,
} from './providers';
import type { IssueSnapshot, PipelineEvent, PullRequestEvent, PullRequestState } from './providers';

export type GitProvider = 'github' | 'gitlab' | 'gitea' | 'forgejo' | 'bitbucket';

export const DEVELOPMENT_PROVIDERS = ['github', 'gitlab', 'gitea', 'forgejo'] as const;
export type DevelopmentProvider = (typeof DEVELOPMENT_PROVIDERS)[number];

export interface ProviderRepository {
  externalId: string;
  fullName: string;
  webUrl: string;
  private: boolean;
  defaultBranch?: string | null;
}

export interface ProviderRepositoryPage {
  repositories: ProviderRepository[];
  nextPage: number | null;
}

export interface ProviderConnectionInput {
  provider: GitProvider;
  baseUrl: string;
  token: string;
}

export interface ProviderPullRequest {
  number: number;
  title: string;
  url: string | null;
  state: PullRequestState;
  draft: boolean;
  sourceBranch: string | null;
  targetBranch: string;
  headSha: string | null;
  updatedAt: string;
}

export interface ProviderPullRequestPage {
  pullRequests: ProviderPullRequest[];
  nextPage: number | null;
}

export interface ProviderPullRequestDetails {
  pullRequest: ProviderPullRequest;
  event: PullRequestEvent;
  run: PipelineEvent | null;
}

export interface ProviderBranchPage {
  branches: string[];
  defaultBranch: string | null;
  nextPage: number | null;
}

export interface CreateProviderPullRequestInput {
  sourceBranch: string;
  targetBranch: string;
  title: string;
  description: string;
  draft: boolean;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function httpUrl(value: unknown): string | null {
  const candidate = text(value);
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function bool(value: unknown): boolean {
  return value === true;
}

export async function normalizeProviderBaseUrl(
  provider: GitProvider,
  raw: string | undefined,
): Promise<string> {
  const fallback =
    provider === 'github'
      ? 'https://github.com'
      : provider === 'gitlab'
        ? 'https://gitlab.com'
        : provider === 'bitbucket'
          ? 'https://bitbucket.org'
          : undefined;
  if (!raw?.trim() && !fallback) throw new HttpError(400, 'baseUrl is required');
  const url = await assertPublicHttpUrl(raw?.trim() || fallback!);
  if (url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) {
    throw new HttpError(400, 'baseUrl must contain only the provider origin');
  }
  if (provider === 'bitbucket' && url.origin !== 'https://bitbucket.org') {
    throw new HttpError(400, 'Only Bitbucket Cloud is supported');
  }
  return url.origin;
}

function apiBase(provider: GitProvider, baseUrl: string): string {
  if (provider === 'github') {
    return baseUrl === 'https://github.com' ? 'https://api.github.com' : `${baseUrl}/api/v3`;
  }
  if (provider === 'bitbucket') {
    return 'https://api.bitbucket.org/2.0';
  }
  if (provider === 'gitea' || provider === 'forgejo') return `${baseUrl}/api/v1`;
  return `${baseUrl}/api/v4`;
}

function providerHeaders(provider: GitProvider, token: string): Headers {
  const headers = new Headers({ accept: 'application/json' });
  if (provider === 'github' || provider === 'bitbucket') {
    headers.set('authorization', `Bearer ${token}`);
    if (provider === 'github') {
      headers.set('accept', 'application/vnd.github+json');
      headers.set('x-github-api-version', '2022-11-28');
    }
  } else if (provider === 'gitea' || provider === 'forgejo') {
    headers.set('authorization', `token ${token}`);
  } else {
    headers.set('private-token', token);
  }
  return headers;
}

export function providerErrorMessage(
  provider: GitProvider,
  status: number,
  message = '',
  rateRemaining?: string | null,
): string {
  const label = PROVIDER_LABEL[provider];
  const detail = message.toLowerCase();
  if (status === 401) return `${label} rejected the access token. Check that it is valid.`;
  if (status === 403 && (rateRemaining === '0' || detail.includes('rate limit'))) {
    return `${label} API rate limit reached. Wait for it to reset and try again.`;
  }
  if (provider === 'github' && status === 403 && detail.includes('sso')) {
    return 'GitHub requires this token to be authorized for organization SSO.';
  }
  if (
    status === 403 &&
    (detail.includes('not accessible') ||
      detail.includes('permission') ||
      detail.includes('forbidden'))
  ) {
    return `${label} token is missing permission to read the repository or manage its webhooks.`;
  }
  if (status === 403) {
    return `${label} denied access. Check the token permissions and organization policy.`;
  }
  if (status === 404) {
    return `${label} could not find this repository, or the token cannot access it.`;
  }
  if (status === 422) {
    return message
      ? `${label} rejected the request: ${message}`
      : `${label} rejected the webhook configuration. Check repository permissions and existing hooks.`;
  }
  return `${label} request failed with status ${status}.`;
}

async function providerRequest(
  input: ProviderConnectionInput,
  path: string,
  init: RequestInit & { allowMissing?: boolean; accept?: string } = {},
): Promise<Response> {
  const headers = providerHeaders(input.provider, input.token);
  if (init.body !== undefined) headers.set('content-type', 'application/json');
  if (init.accept) headers.set('accept', init.accept);
  let response: Response;
  try {
    response = await pinnedFetch(`${apiBase(input.provider, input.baseUrl)}${path}`, {
      method: init.method,
      headers,
      body: init.body as string | undefined,
      timeoutMs: 15_000,
    });
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(
      502,
      `${PROVIDER_LABEL[input.provider]} could not be reached. Check the provider URL and network access.`,
    );
  }
  const missing = response.status === 404 && (init.method === 'DELETE' || init.allowMissing);
  if (!response.ok && !missing) {
    const body = record(
      await response
        .clone()
        .json()
        .catch(() => null),
    );
    // GitHub answers a 422 with "Validation Failed" and gives the reason only in `errors`.
    const reasons = (Array.isArray(body?.errors) ? body.errors : []).map(
      (item: unknown) =>
        text(item) ??
        text(record(item)?.message) ??
        [record(item)?.resource, record(item)?.field, record(item)?.code].filter(text).join(' '),
    );
    const message = [
      text(body?.message) ?? text(body?.error_description) ?? text(body?.error),
      ...reasons,
    ]
      .filter(Boolean)
      .join(': ');
    const actionable = [401, 403, 404, 422].includes(response.status);
    throw new HttpError(
      actionable ? 400 : 502,
      providerErrorMessage(
        input.provider,
        response.status,
        message,
        response.headers.get('x-ratelimit-remaining'),
      ),
    );
  }
  return response;
}

export interface ProviderProfile {
  // The account's id on the host. A login can pass to someone else after a rename; the
  // id cannot.
  id: string;
  login: string;
  name: string | null;
  avatarUrl: string | null;
}

// The account a token signs in as.
export async function getProviderProfile(input: ProviderConnectionInput): Promise<ProviderProfile> {
  const response = await providerRequest(input, '/user');
  const body = record(await response.json());
  if (input.provider === 'bitbucket') {
    const id = text(body?.uuid);
    const login = text(body?.nickname) ?? text(body?.username) ?? text(body?.display_name);
    if (!id || !login) throw new HttpError(502, `${input.provider} returned an invalid account`);
    return {
      id,
      login,
      name: text(body?.display_name),
      avatarUrl: httpUrl(record(record(body?.links)?.avatar)?.href),
    };
  }
  const id = numericId(body);
  const login = text(body?.[input.provider === 'gitlab' ? 'username' : 'login']);
  if (!id || !login) throw new HttpError(502, `${input.provider} returned an invalid account`);
  return {
    id,
    login,
    name: text(
      body?.[input.provider === 'gitlab' || input.provider === 'github' ? 'name' : 'full_name'],
    ),
    avatarUrl: httpUrl(body?.avatar_url),
  };
}

// A GitHub, Gitea or Forgejo repository whose webhooks the token manages.
export function githubRepository(value: unknown): ProviderRepository | null {
  if (!bool(record(record(value)?.permissions)?.admin)) return null;
  return readableRepository(value);
}

// A GitHub, Gitea or Forgejo repository the token reaches, whatever its rights there.
function readableRepository(value: unknown): ProviderRepository | null {
  const row = record(value);
  const id = row?.id;
  const fullName = text(row?.full_name);
  const webUrl = httpUrl(row?.html_url);
  if ((typeof id !== 'number' && typeof id !== 'string') || !fullName || !webUrl) return null;
  const defaultBranch = text(row?.default_branch);
  return {
    externalId: String(id),
    fullName,
    webUrl,
    private: bool(row?.private),
    ...(defaultBranch ? { defaultBranch } : {}),
  };
}

export function gitlabRepository(value: unknown): ProviderRepository | null {
  const row = record(value);
  const id = row?.id;
  const fullName = text(row?.path_with_namespace);
  const webUrl = httpUrl(row?.web_url);
  if ((typeof id !== 'number' && typeof id !== 'string') || !fullName || !webUrl) return null;
  const defaultBranch = text(row?.default_branch);
  return {
    externalId: String(id),
    fullName,
    webUrl,
    private: row?.visibility !== 'public',
    ...(defaultBranch ? { defaultBranch } : {}),
  };
}

export function giteaRepository(value: unknown): ProviderRepository | null {
  return githubRepository(value);
}

export function bitbucketRepository(value: unknown): ProviderRepository | null {
  const row = record(value);
  const fullName = text(row?.full_name);
  const webUrl =
    httpUrl(record(record(row?.links)?.html)?.href) ??
    (fullName && fullName.split('/').length === 2
      ? `https://bitbucket.org/${fullName.split('/').map(encodeURIComponent).join('/')}`
      : null);
  if (!fullName || !webUrl) return null;
  return { externalId: fullName, fullName, webUrl, private: row?.is_private !== false };
}

async function listBitbucketRepositories(
  input: ProviderConnectionInput,
  page: number,
  search: string,
  perPage: number,
): Promise<ProviderRepositoryPage> {
  const workspacesResponse = await providerRequest(input, '/user/workspaces?pagelen=100');
  const workspaceRows = record(await workspacesResponse.json())?.values;
  if (!Array.isArray(workspaceRows))
    throw new HttpError(502, 'bitbucket returned an invalid workspace list');
  const slugs = workspaceRows
    .map((item) => text(record(record(item)?.workspace)?.slug))
    .filter((slug): slug is string => slug !== null);
  const repositories: ProviderRepository[] = [];
  for (const slug of slugs) {
    let permissionPage = 1;
    let hasNext = true;
    while (hasNext && permissionPage <= 10) {
      const params = new URLSearchParams({
        pagelen: '100',
        page: String(permissionPage),
        q: 'permission="admin"',
      });
      const response = await providerRequest(
        input,
        `/user/workspaces/${encodeURIComponent(slug)}/permissions/repositories?${params}`,
      );
      const body = record(await response.json());
      const values = body?.values;
      if (!Array.isArray(values))
        throw new HttpError(502, 'bitbucket returned an invalid repository permission list');
      repositories.push(
        ...values
          .map((item) => bitbucketRepository(record(item)?.repository))
          .filter((repo): repo is ProviderRepository => repo !== null),
      );
      hasNext = text(body?.next) !== null;
      permissionPage += 1;
    }
  }
  const needle = search.toLowerCase();
  const filtered = [
    ...new Map(repositories.map((repository) => [repository.fullName, repository])).values(),
  ]
    .filter((repository) => !needle || repository.fullName.toLowerCase().includes(needle))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
  const start = (page - 1) * perPage;
  return {
    repositories: filtered.slice(start, start + perPage),
    nextPage: start + perPage < filtered.length ? page + 1 : null,
  };
}

// `reach` picks the repositories: `admin` those whose webhooks the token manages, `any`
// every one it can read. Bitbucket is listed only by `admin`: no account of a member
// is on Bitbucket.
export async function listProviderRepositories(
  input: ProviderConnectionInput,
  page: number,
  search: string,
  reach: 'admin' | 'any' = 'admin',
): Promise<ProviderRepositoryPage> {
  const perPage = 30;
  if (input.provider === 'bitbucket')
    return listBitbucketRepositories(input, page, search, perPage);
  const params = new URLSearchParams({ page: String(page) });
  if (input.provider === 'gitlab') {
    params.set('per_page', String(perPage));
    params.set('membership', 'true');
    // 40 is Maintainer, the least that manages webhooks; 10 is Guest.
    params.set('min_access_level', reach === 'admin' ? '40' : '10');
    params.set('simple', 'true');
    params.set('order_by', 'last_activity_at');
    params.set('sort', 'desc');
    if (search) params.set('search', search);
  } else if (input.provider === 'github') {
    params.set('per_page', String(perPage));
    params.set('affiliation', 'owner,collaborator,organization_member');
    params.set('sort', 'pushed');
    params.set('direction', 'desc');
  } else if (input.provider === 'gitea' || input.provider === 'forgejo') {
    params.set('limit', String(perPage));
    if (search) params.set('q', search);
  }
  const endpoint = input.provider === 'gitlab' ? '/projects' : '/user/repos';
  const response = await providerRequest(input, `${endpoint}?${params}`);
  const responseBody: unknown = await response.json();
  const body = responseBody;
  if (!Array.isArray(body))
    throw new HttpError(502, `${input.provider} returned an invalid repository list`);
  let map = gitlabRepository;
  if (input.provider !== 'gitlab') map = reach === 'admin' ? githubRepository : readableRepository;
  let repositories = body.map(map).filter((repo): repo is ProviderRepository => repo !== null);
  if (
    (input.provider === 'github' || input.provider === 'gitea' || input.provider === 'forgejo') &&
    search
  ) {
    const needle = search.toLowerCase();
    repositories = repositories.filter((repo) => repo.fullName.toLowerCase().includes(needle));
  }
  return { repositories, nextPage: nextPageNumber(response, page, body.length, perPage) };
}

export async function getProviderRepository(
  input: ProviderConnectionInput,
  externalId: string,
): Promise<ProviderRepository> {
  const endpoint =
    input.provider === 'gitlab'
      ? `/projects/${encodeURIComponent(externalId)}`
      : input.provider === 'bitbucket'
        ? `/repositories/${externalId.split('/').map(encodeURIComponent).join('/')}`
        : `/repositories/${encodeURIComponent(externalId)}`;
  const response = await providerRequest(input, endpoint);
  const body = await response.json();
  const repository =
    input.provider === 'github'
      ? githubRepository(body)
      : input.provider === 'gitlab'
        ? gitlabRepository(body)
        : input.provider === 'bitbucket'
          ? bitbucketRepository(body)
          : giteaRepository(body);
  if (!repository) throw new HttpError(400, 'Repository is unavailable or cannot manage webhooks');
  return repository;
}

function githubRepoPath(fullName: string): string {
  const parts = fullName.split('/');
  if (parts.length !== 2 || parts.some((part) => !part))
    throw new HttpError(400, 'Invalid repository name');
  return `/repos/${parts.map(encodeURIComponent).join('/')}`;
}

function bitbucketRepoPath(fullName: string): string {
  const parts = fullName.split('/');
  if (parts.length !== 2 || parts.some((part) => !part))
    throw new HttpError(400, 'Invalid repository name');
  return `/repositories/${parts.map(encodeURIComponent).join('/')}`;
}

function isoText(value: unknown): string | null {
  const raw = text(value);
  if (!raw || Number.isNaN(Date.parse(raw))) return null;
  return new Date(raw).toISOString();
}

export function githubPullRequest(value: unknown): ProviderPullRequest | null {
  const row = record(value);
  const number = row?.number;
  const title = text(row?.title);
  const targetBranch = text(record(row?.base)?.ref);
  const stateValue = text(row?.state);
  const updatedAt = isoText(row?.updated_at);
  if (typeof number !== 'number' || !title || !targetBranch || !stateValue || !updatedAt)
    return null;
  return {
    number,
    title,
    url: httpUrl(row?.html_url),
    state: text(row?.merged_at) ? 'merged' : stateValue === 'closed' ? 'closed' : 'open',
    draft: bool(row?.draft),
    sourceBranch: text(record(row?.head)?.ref),
    targetBranch,
    headSha: text(record(row?.head)?.sha),
    updatedAt,
  };
}

export function gitlabPullRequest(value: unknown): ProviderPullRequest | null {
  const row = record(value);
  const number = row?.iid;
  const title = text(row?.title);
  const targetBranch = text(row?.target_branch);
  const stateValue = text(row?.state);
  const updatedAt = isoText(row?.updated_at);
  if (typeof number !== 'number' || !title || !targetBranch || !stateValue || !updatedAt)
    return null;
  return {
    number,
    title,
    url: httpUrl(row?.web_url),
    state: stateValue === 'merged' ? 'merged' : stateValue === 'closed' ? 'closed' : 'open',
    draft: bool(row?.draft) || bool(row?.work_in_progress),
    sourceBranch: text(row?.source_branch),
    targetBranch,
    headSha: text(row?.sha) ?? text(record(row?.diff_refs)?.head_sha),
    updatedAt,
  };
}

function pullRequestEvent(
  provider: GitProvider,
  repository: ProviderRepository,
  row: Record<string, unknown>,
  pullRequest: ProviderPullRequest,
): PullRequestEvent {
  return {
    kind: 'pull_request',
    action:
      pullRequest.state === 'merged'
        ? 'merged'
        : pullRequest.state === 'closed'
          ? 'closed'
          : 'opened',
    number: pullRequest.number,
    title: pullRequest.title,
    body: text(provider === 'gitlab' ? row.description : row.body) ?? '',
    url: pullRequest.url,
    repo: repository.fullName,
    sourceBranch: pullRequest.sourceBranch,
    targetBranch: pullRequest.targetBranch,
    headSha: pullRequest.headSha,
    defaultBranch: repository.defaultBranch ?? null,
    draft: pullRequest.draft,
  };
}

function gitlabPipeline(
  value: unknown,
  repository: ProviderRepository,
  pullRequest: ProviderPullRequest,
): PipelineEvent | null {
  const row = record(value);
  const id = row?.id;
  const status = pipelineStatus(text(row?.status) ?? undefined);
  const headSha = text(row?.sha) ?? pullRequest.headSha;
  if ((typeof id !== 'number' && typeof id !== 'string') || !status || !headSha) return null;
  return {
    kind: 'pipeline',
    repo: repository.fullName,
    pullRequestNumber: pullRequest.number,
    headSha,
    status,
    url: httpUrl(row?.web_url),
  };
}

function githubWorkflowRun(
  value: unknown,
  repository: ProviderRepository,
  pullRequest: ProviderPullRequest,
): PipelineEvent | null {
  const row = record(value);
  const id = row?.id;
  const status = pipelineStatus(text(row?.conclusion) ?? text(row?.status) ?? undefined);
  const headSha = text(row?.head_sha);
  if ((typeof id !== 'number' && typeof id !== 'string') || !status || !headSha) return null;
  return {
    kind: 'pipeline',
    repo: repository.fullName,
    pullRequestNumber: pullRequest.number,
    headSha,
    status,
    url: httpUrl(row?.html_url),
  };
}

export function ensureDevelopmentProvider(
  provider: string,
): asserts provider is DevelopmentProvider {
  if (!(DEVELOPMENT_PROVIDERS as readonly string[]).includes(provider))
    throw new HttpError(
      400,
      'Creating and linking pull requests supports GitHub, GitLab, Gitea and Forgejo',
    );
}

// A Forgejo server labels its webhook deliveries 'forgejo' even on a connection saved as
// Gitea, and a development link is matched to later deliveries by that label. Only Forgejo
// serves this route and Gitea answers 404. Any other answer, such as a proxy refusing the
// path, keeps the provider the connection was saved as.
export async function resolveLinkProvider(
  input: ProviderConnectionInput & { provider: DevelopmentProvider },
): Promise<DevelopmentProvider> {
  if (input.provider !== 'gitea' && input.provider !== 'forgejo') return input.provider;
  const response = await pinnedFetch(`${input.baseUrl}/api/forgejo/v1/version`, {
    headers: providerHeaders(input.provider, input.token),
    timeoutMs: 15_000,
  }).catch(() => null);
  if (response?.ok) return 'forgejo';
  if (response?.status === 404) return 'gitea';
  return input.provider;
}

// Gitea and Forgejo cap the page size on the server and name the next page only in the
// Link header, so a page shorter than requested is not always the last one.
function nextPageNumber(
  response: Response,
  page: number,
  count: number,
  perPage: number,
): number | null {
  // A next page that does not advance would repeat pages forever.
  const providerNext = Number(response.headers.get('x-next-page'));
  if (providerNext) return providerNext > page ? providerNext : null;
  const link = response.headers.get('link');
  if (link) return link.includes('rel="next"') ? page + 1 : null;
  return count === perPage ? page + 1 : null;
}

function pageSizeParam(provider: DevelopmentProvider): 'limit' | 'per_page' {
  return provider === 'gitea' || provider === 'forgejo' ? 'limit' : 'per_page';
}

export async function listProviderPullRequests(
  input: ProviderConnectionInput,
  repository: ProviderRepository,
  state: 'open' | 'all',
  page: number,
): Promise<ProviderPullRequestPage> {
  ensureDevelopmentProvider(input.provider);
  const perPage = 50;
  const params = new URLSearchParams({
    page: String(page),
    [pageSizeParam(input.provider)]: String(perPage),
  });
  if (input.provider === 'gitlab') {
    params.set('scope', 'all');
    params.set('state', state === 'open' ? 'opened' : 'all');
    params.set('order_by', 'updated_at');
    params.set('sort', 'desc');
  } else if (input.provider === 'github') {
    params.set('state', state);
    params.set('sort', 'updated');
    params.set('direction', 'desc');
  } else {
    params.set('state', state);
    params.set('sort', 'recentupdate');
  }
  const path =
    input.provider === 'gitlab'
      ? `/projects/${encodeURIComponent(repository.externalId)}/merge_requests?${params}`
      : `${githubRepoPath(repository.fullName)}/pulls?${params}`;
  const response = await providerRequest(input, path);
  const body: unknown = await response.json();
  if (!Array.isArray(body))
    throw new HttpError(502, `${input.provider} returned an invalid pull request list`);
  const normalize = input.provider === 'gitlab' ? gitlabPullRequest : githubPullRequest;
  const pullRequests = body
    .map(normalize)
    .filter((pullRequest): pullRequest is ProviderPullRequest => pullRequest !== null);
  return { pullRequests, nextPage: nextPageNumber(response, page, body.length, perPage) };
}

export async function getProviderPullRequest(
  input: ProviderConnectionInput,
  repository: ProviderRepository,
  number: number,
): Promise<ProviderPullRequestDetails> {
  ensureDevelopmentProvider(input.provider);
  const currentRepository = await getProviderRepository(input, repository.externalId);
  const path =
    input.provider === 'gitlab'
      ? `/projects/${encodeURIComponent(repository.externalId)}/merge_requests/${number}`
      : `${githubRepoPath(repository.fullName)}/pulls/${number}`;
  const response = await providerRequest(input, path);
  const body = record(await response.json());
  if (!body) throw new HttpError(502, `${input.provider} returned an invalid pull request`);
  const pullRequest =
    input.provider === 'gitlab' ? gitlabPullRequest(body) : githubPullRequest(body);
  if (!pullRequest) throw new HttpError(502, `${input.provider} returned an invalid pull request`);

  // No CI status for Gitea and Forgejo: their webhooks are not subscribed to it either.
  let run: PipelineEvent | null = null;
  if (input.provider === 'gitlab') {
    run = gitlabPipeline(body.head_pipeline, currentRepository, pullRequest);
  } else if (input.provider === 'github' && pullRequest.headSha) {
    try {
      const params = new URLSearchParams({ head_sha: pullRequest.headSha, per_page: '1' });
      const runsResponse = await providerRequest(
        input,
        `${githubRepoPath(repository.fullName)}/actions/runs?${params}`,
      );
      const runs = record(await runsResponse.json())?.workflow_runs;
      if (Array.isArray(runs)) run = githubWorkflowRun(runs[0], currentRepository, pullRequest);
    } catch {
      run = null;
    }
  }
  return {
    pullRequest,
    event: pullRequestEvent(input.provider, currentRepository, body, pullRequest),
    run,
  };
}

export async function listProviderBranches(
  input: ProviderConnectionInput,
  repository: ProviderRepository,
  page: number,
): Promise<ProviderBranchPage> {
  ensureDevelopmentProvider(input.provider);
  const perPage = 100;
  const currentRepository = await getProviderRepository(input, repository.externalId);
  const params = new URLSearchParams({
    page: String(page),
    [pageSizeParam(input.provider)]: String(perPage),
  });
  const path =
    input.provider === 'gitlab'
      ? `/projects/${encodeURIComponent(repository.externalId)}/repository/branches?${params}`
      : `${githubRepoPath(repository.fullName)}/branches?${params}`;
  const response = await providerRequest(input, path);
  const body: unknown = await response.json();
  if (!Array.isArray(body))
    throw new HttpError(502, `${input.provider} returned an invalid branch list`);
  const branches = body
    .map((item) => text(record(item)?.name))
    .filter((name): name is string => name !== null);
  return {
    branches,
    defaultBranch: currentRepository.defaultBranch ?? null,
    nextPage: nextPageNumber(response, page, body.length, perPage),
  };
}

function draftTitle(provider: DevelopmentProvider, title: string): string {
  if (provider === 'github') return title;
  if (provider === 'gitlab') return /^(draft:|wip:)/i.test(title) ? title : `Draft: ${title}`;
  // Gitea and Forgejo have no draft flag on create; these are their default draft prefixes.
  return /^(wip:|\[wip\])/i.test(title) ? title : `WIP: ${title}`;
}

export async function createProviderPullRequest(
  input: ProviderConnectionInput,
  repository: ProviderRepository,
  values: CreateProviderPullRequestInput,
): Promise<ProviderPullRequestDetails> {
  ensureDevelopmentProvider(input.provider);
  const path =
    input.provider === 'gitlab'
      ? `/projects/${encodeURIComponent(repository.externalId)}/merge_requests`
      : `${githubRepoPath(repository.fullName)}/pulls`;
  const title = values.draft ? draftTitle(input.provider, values.title) : values.title;
  const body =
    input.provider === 'gitlab'
      ? {
          title,
          description: values.description,
          source_branch: values.sourceBranch,
          target_branch: values.targetBranch,
          allow_collaboration: true,
        }
      : {
          title,
          body: values.description,
          head: values.sourceBranch,
          base: values.targetBranch,
          ...(input.provider === 'github'
            ? { draft: values.draft, maintainer_can_modify: true }
            : {}),
        };
  const response = await providerRequest(input, path, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const created = record(await response.json());
  if (!created) throw new HttpError(502, `${input.provider} returned an invalid pull request`);
  const pullRequest =
    input.provider === 'gitlab' ? gitlabPullRequest(created) : githubPullRequest(created);
  if (!pullRequest) throw new HttpError(502, `${input.provider} returned an invalid pull request`);
  return {
    pullRequest,
    event: pullRequestEvent(input.provider, repository, created, pullRequest),
    run:
      input.provider === 'gitlab'
        ? gitlabPipeline(created.head_pipeline, repository, pullRequest)
        : null,
  };
}

interface ProviderWebhookApi {
  hooksPath: string;
  listQuery: string;
  updateMethod: 'PATCH' | 'PUT';
  hooks(body: unknown): unknown[];
  url(hook: Record<string, unknown> | null): string | null;
  id(hook: Record<string, unknown> | null): string | null;
  body(create: boolean): unknown;
}

function numericId(row: Record<string, unknown> | null): string | null {
  const id = row?.id;
  return typeof id === 'number' || typeof id === 'string' ? String(id) : null;
}

// `issueEvents` adds the issue and comment events a repository with issue sync needs.
function providerWebhookApi(
  provider: GitProvider,
  repository: ProviderRepository,
  payloadUrl: string,
  secret: string,
  issueEvents: boolean,
): ProviderWebhookApi {
  const issueHooks = issueEvents ? ['issues', 'issue_comment'] : [];
  const arrayBody = (body: unknown) => (Array.isArray(body) ? body : []);
  const configUrl = (hook: Record<string, unknown> | null) => text(record(hook?.config)?.url);
  if (provider === 'gitlab') {
    return {
      hooksPath: `/projects/${encodeURIComponent(repository.externalId)}/hooks`,
      listQuery: '?per_page=100',
      updateMethod: 'PUT',
      hooks: arrayBody,
      url: (hook) => text(hook?.url),
      id: numericId,
      body: () => ({
        url: payloadUrl,
        token: secret,
        merge_requests_events: true,
        pipeline_events: true,
        push_events: true,
        issues_events: issueEvents,
        note_events: issueEvents,
        enable_ssl_verification: true,
      }),
    };
  }
  if (provider === 'gitea' || provider === 'forgejo') {
    return {
      hooksPath: `${githubRepoPath(repository.fullName)}/hooks`,
      listQuery: '?limit=100',
      updateMethod: 'PATCH',
      hooks: arrayBody,
      url: configUrl,
      id: numericId,
      body: (create) => ({
        ...(create ? { type: 'gitea' } : {}),
        active: true,
        events: ['pull_request', 'create', 'delete', ...issueHooks],
        config: { url: payloadUrl, content_type: 'json', secret },
      }),
    };
  }
  if (provider === 'bitbucket') {
    return {
      hooksPath: `${bitbucketRepoPath(repository.fullName)}/hooks`,
      listQuery: '?pagelen=100',
      updateMethod: 'PUT',
      hooks: (body) => arrayBody(record(body)?.values),
      url: (hook) => text(hook?.url),
      id: (hook) => text(hook?.uuid),
      body: () => ({
        description: "It's a Plan",
        url: payloadUrl,
        active: true,
        secret,
        events: [
          'pullrequest:created',
          'pullrequest:updated',
          'pullrequest:fulfilled',
          'pullrequest:rejected',
          'repo:branch_created',
          'repo:branch_deleted',
        ],
      }),
    };
  }
  return {
    hooksPath: `${githubRepoPath(repository.fullName)}/hooks`,
    listQuery: '?per_page=100',
    updateMethod: 'PATCH',
    hooks: arrayBody,
    url: configUrl,
    id: numericId,
    body: (create) => ({
      ...(create ? { name: 'web' } : {}),
      active: true,
      events: ['pull_request', 'check_run', 'create', 'delete', ...issueHooks],
      config: { url: payloadUrl, content_type: 'json', insecure_ssl: '0', secret },
    }),
  };
}

// Updates the hook stored as `webhookExternalId` in place, whatever URL it has now.
// Without a stored id (first install) it reuses a hook with this exact URL. A stored
// hook the provider no longer has is created again.
export async function installProviderWebhook(
  input: ProviderConnectionInput,
  repository: ProviderRepository,
  payloadUrl: string,
  secret: string,
  webhookExternalId: string | null,
  issueEvents: boolean,
): Promise<string> {
  const api = providerWebhookApi(input.provider, repository, payloadUrl, secret, issueEvents);
  let existingId = webhookExternalId;
  if (existingId === null) {
    const hooksResponse = await providerRequest(input, `${api.hooksPath}${api.listQuery}`);
    const existing = api
      .hooks(await hooksResponse.json())
      .map(record)
      .find((hook) => api.url(hook) === payloadUrl);
    existingId = existing ? api.id(existing) : null;
  }
  let response: Response | null = null;
  if (existingId !== null) {
    response = await providerRequest(input, `${api.hooksPath}/${encodeURIComponent(existingId)}`, {
      method: api.updateMethod,
      body: JSON.stringify(api.body(false)),
      allowMissing: true,
    });
    if (response.status === 404) response = null;
  }
  response ??= await providerRequest(input, api.hooksPath, {
    method: 'POST',
    body: JSON.stringify(api.body(true)),
  });
  const id = api.id(record(await response.json()));
  if (!id)
    throw new HttpError(502, `${PROVIDER_LABEL[input.provider]} returned an invalid webhook`);
  return id;
}

export async function deleteProviderWebhook(
  input: ProviderConnectionInput,
  repository: ProviderRepository,
  webhookExternalId: string,
): Promise<void> {
  const path =
    input.provider === 'gitlab'
      ? `/projects/${encodeURIComponent(repository.externalId)}/hooks/${encodeURIComponent(webhookExternalId)}`
      : `${
          input.provider === 'bitbucket'
            ? bitbucketRepoPath(repository.fullName)
            : githubRepoPath(repository.fullName)
        }/hooks/${encodeURIComponent(webhookExternalId)}`;
  await providerRequest(input, path, { method: 'DELETE' });
}

export async function createPullRequestComment(
  input: ProviderConnectionInput,
  repository: ProviderRepository,
  number: number,
  body: string,
): Promise<void> {
  const path =
    input.provider === 'gitlab'
      ? `/projects/${encodeURIComponent(repository.externalId)}/merge_requests/${number}/notes`
      : input.provider === 'bitbucket'
        ? `${bitbucketRepoPath(repository.fullName)}/pullrequests/${number}/comments`
        : `${githubRepoPath(repository.fullName)}/issues/${number}/comments`;
  await providerRequest(input, path, {
    method: 'POST',
    body: JSON.stringify(input.provider === 'bitbucket' ? { content: { raw: body } } : { body }),
  });
}

function repositoryApiPath(input: ProviderConnectionInput, repository: ProviderRepository): string {
  return input.provider === 'gitlab'
    ? `/projects/${encodeURIComponent(repository.externalId)}`
    : githubRepoPath(repository.fullName);
}

// One page of the repository's open issues, oldest first, so a page read later still
// starts after the issues an earlier page held.
export async function listProviderOpenIssues(
  input: ProviderConnectionInput,
  repository: ProviderRepository,
  page: number,
): Promise<{ issues: (IssueSnapshot & { hasComments: boolean })[]; nextPage: number | null }> {
  ensureDevelopmentProvider(input.provider);
  const perPage = 50;
  const params = new URLSearchParams({
    page: String(page),
    [pageSizeParam(input.provider)]: String(perPage),
  });
  if (input.provider === 'gitlab') {
    params.set('state', 'opened');
    params.set('order_by', 'created_at');
    params.set('sort', 'asc');
  } else if (input.provider === 'github') {
    params.set('state', 'open');
    params.set('sort', 'created');
    params.set('direction', 'asc');
  } else {
    params.set('state', 'open');
    params.set('type', 'issues');
  }
  const response = await providerRequest(
    input,
    `${repositoryApiPath(input, repository)}/issues?${params}`,
  );
  const body: unknown = await response.json();
  if (!Array.isArray(body))
    throw new HttpError(502, `${PROVIDER_LABEL[input.provider]} returned an invalid issue list`);
  const normalize = input.provider === 'gitlab' ? gitlabIssueSnapshot : githubIssueSnapshot;
  return {
    issues: body.flatMap((item) => {
      const issue = normalize(item);
      // A count the provider did not send is not taken as zero.
      const count = record(item)?.comments ?? record(item)?.user_notes_count;
      return issue ? [{ ...issue, hasComments: typeof count !== 'number' || count > 0 }] : [];
    }),
    nextPage: nextPageNumber(response, page, body.length, perPage),
  };
}

export interface ProviderIssueComment {
  id: string;
  body: string;
  author: string | null;
  authorId: string | null;
}

function issueCommentsPath(
  input: ProviderConnectionInput,
  repository: ProviderRepository,
  number: number,
): string {
  const kind = input.provider === 'gitlab' ? 'notes' : 'comments';
  return `${repositoryApiPath(input, repository)}/issues/${number}/${kind}`;
}

// GitLab keeps a note under its issue; GitHub, Gitea and Forgejo name a comment by its
// id alone.
function issueCommentPath(
  input: ProviderConnectionInput,
  repository: ProviderRepository,
  number: number,
  id: string,
): string {
  return input.provider === 'gitlab'
    ? `${issueCommentsPath(input, repository, number)}/${encodeURIComponent(id)}`
    : `${githubRepoPath(repository.fullName)}/issues/comments/${encodeURIComponent(id)}`;
}

// The comments of one repository issue, oldest first, up to 20 pages. Gitea and Forgejo
// do not page this list and send every comment at once. GitLab system notes and internal
// notes are left out.
export async function listProviderIssueComments(
  input: ProviderConnectionInput,
  repository: ProviderRepository,
  number: number,
): Promise<ProviderIssueComment[]> {
  ensureDevelopmentProvider(input.provider);
  const gitlab = input.provider === 'gitlab';
  const paged = gitlab || input.provider === 'github';
  const path = issueCommentsPath(input, repository, number);
  const perPage = 100;
  const comments: ProviderIssueComment[] = [];
  for (let page: number | null = 1; page !== null && page <= 20;) {
    const params = new URLSearchParams(
      paged ? { page: String(page), per_page: String(perPage) } : {},
    );
    if (gitlab) {
      params.set('order_by', 'created_at');
      params.set('sort', 'asc');
    }
    const query = params.toString();
    const response = await providerRequest(input, query ? `${path}?${query}` : path);
    const body: unknown = await response.json();
    if (!Array.isArray(body))
      throw new HttpError(
        502,
        `${PROVIDER_LABEL[input.provider]} returned an invalid comment list`,
      );
    for (const item of body) {
      const row = record(item);
      const id = numericId(row);
      const content = text(row?.body);
      if (!row || !id || !content || row.system === true || row.internal === true) continue;
      const author = record(gitlab ? row.author : row.user);
      comments.push({
        id,
        body: content,
        author: text(gitlab ? author?.username : author?.login),
        authorId: numericId(author),
      });
    }
    page = paged ? nextPageNumber(response, page, body.length, perPage) : null;
  }
  return comments;
}

// Writes a comment on a repository issue and returns its id there.
export async function createProviderIssueComment(
  input: ProviderConnectionInput,
  repository: ProviderRepository,
  number: number,
  body: string,
): Promise<string> {
  ensureDevelopmentProvider(input.provider);
  const response = await providerRequest(input, issueCommentsPath(input, repository, number), {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
  const id = numericId(record(await response.json()));
  if (!id)
    throw new HttpError(502, `${PROVIDER_LABEL[input.provider]} returned an invalid comment`);
  return id;
}

export async function updateProviderIssueComment(
  input: ProviderConnectionInput,
  repository: ProviderRepository,
  number: number,
  id: string,
  body: string,
): Promise<void> {
  ensureDevelopmentProvider(input.provider);
  await providerRequest(input, issueCommentPath(input, repository, number, id), {
    method: input.provider === 'gitlab' ? 'PUT' : 'PATCH',
    body: JSON.stringify({ body }),
  });
}

// A comment the repository no longer has counts as deleted.
export async function deleteProviderIssueComment(
  input: ProviderConnectionInput,
  repository: ProviderRepository,
  number: number,
  id: string,
): Promise<void> {
  ensureDevelopmentProvider(input.provider);
  await providerRequest(input, issueCommentPath(input, repository, number, id), {
    method: 'DELETE',
  });
}

export interface ProviderLabel {
  name: string;
  // "#rrggbb", or null when the provider sent no usable color.
  color: string | null;
}

function labelColor(value: unknown): string | null {
  const hex = text(value)?.replace(/^#/, '');
  return hex && /^[0-9a-f]{6}$/i.test(hex) ? `#${hex.toLowerCase()}` : null;
}

// The repository's labels, by name, up to 20 pages (1,000 labels): a server that keeps
// naming a next page cannot hold the request.
export async function listProviderLabels(
  input: ProviderConnectionInput,
  repository: ProviderRepository,
): Promise<ProviderLabel[]> {
  ensureDevelopmentProvider(input.provider);
  const perPage = 50;
  const labels = new Map<string, ProviderLabel>();
  for (let page: number | null = 1; page !== null && page <= 20;) {
    const params = new URLSearchParams({
      page: String(page),
      [pageSizeParam(input.provider)]: String(perPage),
    });
    const response = await providerRequest(
      input,
      `${repositoryApiPath(input, repository)}/labels?${params}`,
    );
    const body: unknown = await response.json();
    if (!Array.isArray(body))
      throw new HttpError(502, `${PROVIDER_LABEL[input.provider]} returned an invalid label list`);
    for (const item of body) {
      const name = text(record(item)?.name);
      if (name) labels.set(name, { name, color: labelColor(record(item)?.color) });
    }
    page = nextPageNumber(response, page, body.length, perPage);
  }
  return [...labels.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function setProviderIssueState(
  input: ProviderConnectionInput,
  repository: ProviderRepository,
  number: number,
  state: 'open' | 'closed',
  reason: 'completed' | 'not_planned',
): Promise<void> {
  ensureDevelopmentProvider(input.provider);
  const path = `${repositoryApiPath(input, repository)}/issues/${number}`;
  if (input.provider === 'gitlab') {
    await providerRequest(input, path, {
      method: 'PUT',
      body: JSON.stringify({ state_event: state === 'closed' ? 'close' : 'reopen' }),
    });
    return;
  }
  await providerRequest(input, path, {
    method: 'PATCH',
    body: JSON.stringify(
      input.provider === 'github' && state === 'closed'
        ? { state, state_reason: reason }
        : { state },
    ),
  });
}

export interface ProviderFileRequest {
  url: string;
  headers?: Record<string, string>;
}

const FILE_UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

// A GitLab upload's name as one path segment. The URL parser reads `\` as `/` and resolves
// `..` and `%2e%2e`, so a name left as written could send the token to another API route.
function uploadName(written: string): string | null {
  let name: string;
  try {
    name = decodeURIComponent(written);
  } catch {
    return null;
  }
  if (name === '.' || name === '..' || /[\\/]/.test(name)) return null;
  return encodeURIComponent(name);
}

function onHost(url: string, baseUrl: string): boolean {
  return url.startsWith('/') ? !url.startsWith('//') : url.startsWith(`${baseUrl}/`);
}

// How to download a file an issue or a comment on the host embeds by `url`, in the order
// to try; null when the url is not a file attached on this host. GitLab and Gitea write
// it as a path on the host.
export function providerFileRequests(
  input: ProviderConnectionInput,
  repository: ProviderRepository,
  url: string,
): ProviderFileRequest[] | null {
  if (input.provider === 'github') {
    const attached =
      url.startsWith(`${input.baseUrl}/user-attachments/`) ||
      url.startsWith(`${repository.webUrl}/assets/`) ||
      url.startsWith('https://user-images.githubusercontent.com/');
    return attached ? [{ url }] : null;
  }
  if (input.provider === 'gitlab') {
    const upload = url.match(/\/uploads\/([0-9a-f]{32})\/([^?#\s/]+)$/);
    if (!upload || !onHost(url, input.baseUrl)) return null;
    const [, secret, written] = upload;
    const filename = uploadName(written!);
    if (!filename) return null;
    return [
      {
        url: `${apiBase(input.provider, input.baseUrl)}/projects/${encodeURIComponent(repository.externalId)}/uploads/${secret}/${filename}`,
        headers: { 'private-token': input.token },
      },
      // GitLab before 17.4 has no download route; a public project serves the file to anyone.
      { url: `${repository.webUrl}/uploads/${secret}/${filename}` },
    ];
  }
  if (input.provider === 'gitea' || input.provider === 'forgejo') {
    const attachment = url.match(/\/attachments\/([0-9a-f-]{36})$/i);
    if (!attachment || !onHost(url, input.baseUrl)) return null;
    return [
      {
        url: `${input.baseUrl}/attachments/${attachment[1]}`,
        headers: { authorization: `token ${input.token}` },
      },
    ];
  }
  return null;
}

// The storage GitHub signs file addresses on. Another link in the rendered text that
// carries a file's id is one the author wrote, to any server.
const SIGNED_FILE_ORIGIN = 'https://private-user-images.githubusercontent.com';

// GitHub renders an issue or a comment with signed addresses of its files, valid for a
// few minutes and readable without a token. The markdown names a file by an address a
// token cannot read on a private repository. Keyed by the file's id.
export async function providerSignedFiles(
  input: ProviderConnectionInput,
  repository: ProviderRepository,
  where: { number: number } | { commentId: string },
): Promise<Map<string, string>> {
  const signed = new Map<string, string>();
  if (input.provider !== 'github') return signed;
  const repoPath = githubRepoPath(repository.fullName);
  const path =
    'number' in where
      ? `${repoPath}/issues/${where.number}`
      : `${repoPath}/issues/comments/${encodeURIComponent(where.commentId)}`;
  const response = await providerRequest(input, path, {
    accept: 'application/vnd.github.full+json',
  });
  const html = text(record(await response.json())?.body_html) ?? '';
  const trusted = [SIGNED_FILE_ORIGIN, new URL(input.baseUrl).origin];
  for (const match of html.matchAll(/\b(?:src|href)="([^"]+)"/g)) {
    const address = match[1]!.replaceAll('&amp;', '&');
    if (!URL.canParse(address) || !trusted.includes(new URL(address).origin)) continue;
    const id = address.match(FILE_UUID)?.[0]?.toLowerCase();
    if (id && !address.includes('/user-attachments/') && !signed.has(id)) signed.set(id, address);
  }
  return signed;
}

export function providerFileId(url: string): string | null {
  return url.match(FILE_UUID)?.[0]?.toLowerCase() ?? null;
}
