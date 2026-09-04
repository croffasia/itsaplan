import { HttpError } from '#shared/lib';
import { assertPublicHttpUrl } from '#shared/net';

export type GitProvider = 'github' | 'gitlab' | 'gitea' | 'forgejo' | 'bitbucket';

export interface ProviderRepository {
  externalId: string;
  fullName: string;
  webUrl: string;
  private: boolean;
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

const PROVIDER_LABEL: Record<GitProvider, string> = {
  github: 'GitHub',
  gitlab: 'GitLab',
  gitea: 'Gitea',
  forgejo: 'Forgejo',
  bitbucket: 'Bitbucket',
};

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
    return `${label} rejected the webhook configuration. Check repository permissions and existing hooks.`;
  }
  return `${label} request failed with status ${status}.`;
}

async function providerRequest(
  input: ProviderConnectionInput,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  await assertPublicHttpUrl(input.baseUrl);
  const headers = providerHeaders(input.provider, input.token);
  if (init.body !== undefined) headers.set('content-type', 'application/json');
  let response: Response;
  try {
    response = await fetch(`${apiBase(input.provider, input.baseUrl)}${path}`, {
      ...init,
      headers,
      redirect: 'manual',
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new HttpError(
      502,
      `${PROVIDER_LABEL[input.provider]} could not be reached. Check the provider URL and network access.`,
    );
  }
  const missingDelete = init.method === 'DELETE' && response.status === 404;
  if (!response.ok && !missingDelete) {
    const body = record(
      await response
        .clone()
        .json()
        .catch(() => null),
    );
    const message = text(body?.message) ?? text(body?.error_description) ?? text(body?.error) ?? '';
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

export async function getProviderAccount(input: ProviderConnectionInput): Promise<string> {
  const response = await providerRequest(input, '/user');
  const body = record(await response.json());
  const login =
    input.provider === 'bitbucket'
      ? (text(body?.nickname) ?? text(body?.username) ?? text(body?.display_name))
      : text(body?.[input.provider === 'gitlab' ? 'username' : 'login']);
  if (!login) throw new HttpError(502, `${input.provider} returned an invalid account`);
  return login;
}

export function githubRepository(value: unknown): ProviderRepository | null {
  const row = record(value);
  const id = row?.id;
  const fullName = text(row?.full_name);
  const webUrl = httpUrl(row?.html_url);
  const permissions = record(row?.permissions);
  if ((typeof id !== 'number' && typeof id !== 'string') || !fullName || !webUrl) return null;
  if (!bool(permissions?.admin)) return null;
  return { externalId: String(id), fullName, webUrl, private: bool(row?.private) };
}

export function gitlabRepository(value: unknown): ProviderRepository | null {
  const row = record(value);
  const id = row?.id;
  const fullName = text(row?.path_with_namespace);
  const webUrl = httpUrl(row?.web_url);
  if ((typeof id !== 'number' && typeof id !== 'string') || !fullName || !webUrl) return null;
  return { externalId: String(id), fullName, webUrl, private: row?.visibility !== 'public' };
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

export async function listProviderRepositories(
  input: ProviderConnectionInput,
  page: number,
  search: string,
): Promise<ProviderRepositoryPage> {
  const perPage = 30;
  if (input.provider === 'bitbucket')
    return listBitbucketRepositories(input, page, search, perPage);
  const params = new URLSearchParams({ page: String(page) });
  if (input.provider === 'gitlab') {
    params.set('per_page', String(perPage));
    params.set('membership', 'true');
    params.set('min_access_level', '40');
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
  const map =
    input.provider === 'github'
      ? githubRepository
      : input.provider === 'gitlab'
        ? gitlabRepository
        : giteaRepository;
  let repositories = body.map(map).filter((repo): repo is ProviderRepository => repo !== null);
  if (
    (input.provider === 'github' || input.provider === 'gitea' || input.provider === 'forgejo') &&
    search
  ) {
    const needle = search.toLowerCase();
    repositories = repositories.filter((repo) => repo.fullName.toLowerCase().includes(needle));
  }
  const providerNext = response.headers.get('x-next-page');
  const nextPage = providerNext
    ? Number(providerNext) || null
    : body.length === perPage
      ? page + 1
      : null;
  return { repositories, nextPage };
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

export async function installProviderWebhook(
  input: ProviderConnectionInput,
  repository: ProviderRepository,
  payloadUrl: string,
  secret: string,
): Promise<string> {
  if (input.provider === 'gitlab') {
    const hooksPath = `/projects/${encodeURIComponent(repository.externalId)}/hooks`;
    const hooksResponse = await providerRequest(input, `${hooksPath}?per_page=100`);
    const hooks: unknown = await hooksResponse.json();
    const existing = Array.isArray(hooks)
      ? hooks.map(record).find((hook) => text(hook?.url) === payloadUrl)
      : undefined;
    const existingId = existing?.id;
    const path =
      typeof existingId === 'number' || typeof existingId === 'string'
        ? `${hooksPath}/${encodeURIComponent(String(existingId))}`
        : hooksPath;
    const response = await providerRequest(input, path, {
      method: existing ? 'PUT' : 'POST',
      body: JSON.stringify({
        url: payloadUrl,
        token: secret,
        merge_requests_events: true,
        pipeline_events: true,
        push_events: true,
        enable_ssl_verification: true,
      }),
    });
    const id = record(await response.json())?.id;
    if (typeof id !== 'number' && typeof id !== 'string')
      throw new HttpError(502, 'GitLab returned an invalid webhook');
    return String(id);
  }

  if (input.provider === 'gitea' || input.provider === 'forgejo') {
    const hooksPath = `${githubRepoPath(repository.fullName)}/hooks`;
    const hooksResponse = await providerRequest(input, `${hooksPath}?limit=100`);
    const hooks: unknown = await hooksResponse.json();
    const existing = Array.isArray(hooks)
      ? hooks.map(record).find((hook) => text(record(hook?.config)?.url) === payloadUrl)
      : undefined;
    const existingId = existing?.id;
    const path =
      typeof existingId === 'number' || typeof existingId === 'string'
        ? `${hooksPath}/${encodeURIComponent(String(existingId))}`
        : hooksPath;
    const response = await providerRequest(input, path, {
      method: existing ? 'PATCH' : 'POST',
      body: JSON.stringify({
        ...(existing ? {} : { type: 'gitea' }),
        active: true,
        events: ['pull_request', 'create', 'delete'],
        config: { url: payloadUrl, content_type: 'json', secret },
      }),
    });
    const id = record(await response.json())?.id;
    if (typeof id !== 'number' && typeof id !== 'string')
      throw new HttpError(502, `${input.provider} returned an invalid webhook`);
    return String(id);
  }

  if (input.provider === 'bitbucket') {
    const hooksPath = `${bitbucketRepoPath(repository.fullName)}/hooks`;
    const hooksResponse = await providerRequest(input, `${hooksPath}?pagelen=100`);
    const hooks = record(await hooksResponse.json())?.values;
    const existing = Array.isArray(hooks)
      ? hooks.map(record).find((hook) => text(hook?.url) === payloadUrl)
      : undefined;
    const existingId = text(existing?.uuid);
    const path = existingId ? `${hooksPath}/${encodeURIComponent(existingId)}` : hooksPath;
    const response = await providerRequest(input, path, {
      method: existing ? 'PUT' : 'POST',
      body: JSON.stringify({
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
    });
    const id = text(record(await response.json())?.uuid);
    if (!id) throw new HttpError(502, 'Bitbucket returned an invalid webhook');
    return id;
  }

  const hooksPath = `${githubRepoPath(repository.fullName)}/hooks`;
  const hooksResponse = await providerRequest(input, `${hooksPath}?per_page=100`);
  const hooks: unknown = await hooksResponse.json();
  const existing = Array.isArray(hooks)
    ? hooks.map(record).find((hook) => text(record(hook?.config)?.url) === payloadUrl)
    : undefined;
  const existingId = existing?.id;
  const path =
    typeof existingId === 'number' || typeof existingId === 'string'
      ? `${hooksPath}/${encodeURIComponent(String(existingId))}`
      : hooksPath;
  const response = await providerRequest(input, path, {
    method: existing ? 'PATCH' : 'POST',
    body: JSON.stringify({
      ...(existing ? {} : { name: 'web' }),
      active: true,
      events: ['pull_request', 'check_run', 'create', 'delete'],
      config: { url: payloadUrl, content_type: 'json', insecure_ssl: '0', secret },
    }),
  });
  const id = record(await response.json())?.id;
  if (typeof id !== 'number' && typeof id !== 'string')
    throw new HttpError(502, 'GitHub returned an invalid webhook');
  return String(id);
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
