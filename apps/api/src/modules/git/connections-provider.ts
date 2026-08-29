import { HttpError } from '#shared/lib';
import { assertPublicHttpUrl } from '#shared/net';

export type GitProvider = 'github' | 'gitlab';

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
  const fallback = provider === 'github' ? 'https://github.com' : 'https://gitlab.com';
  const url = await assertPublicHttpUrl(raw?.trim() || fallback);
  if (url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) {
    throw new HttpError(400, 'baseUrl must contain only the provider origin');
  }
  return url.origin;
}

function apiBase(provider: GitProvider, baseUrl: string): string {
  if (provider === 'github') {
    return baseUrl === 'https://github.com' ? 'https://api.github.com' : `${baseUrl}/api/v3`;
  }
  return `${baseUrl}/api/v4`;
}

function providerHeaders(provider: GitProvider, token: string): Headers {
  const headers = new Headers({ accept: 'application/json' });
  if (provider === 'github') {
    headers.set('accept', 'application/vnd.github+json');
    headers.set('authorization', `Bearer ${token}`);
    headers.set('x-github-api-version', '2022-11-28');
  } else {
    headers.set('private-token', token);
  }
  return headers;
}

async function providerRequest(
  input: ProviderConnectionInput,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  await assertPublicHttpUrl(input.baseUrl);
  const headers = providerHeaders(input.provider, input.token);
  if (init.body !== undefined) headers.set('content-type', 'application/json');
  const response = await fetch(`${apiBase(input.provider, input.baseUrl)}${path}`, {
    ...init,
    headers,
    redirect: 'manual',
    signal: AbortSignal.timeout(15_000),
  });
  const missingDelete = init.method === 'DELETE' && response.status === 404;
  if (!response.ok && !missingDelete) {
    const status = response.status === 401 || response.status === 403 ? 400 : 502;
    throw new HttpError(status, `${input.provider} request failed with status ${response.status}`);
  }
  return response;
}

export async function getProviderAccount(input: ProviderConnectionInput): Promise<string> {
  const response = await providerRequest(input, '/user');
  const body = record(await response.json());
  const login = text(body?.[input.provider === 'github' ? 'login' : 'username']);
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

export async function listProviderRepositories(
  input: ProviderConnectionInput,
  page: number,
  search: string,
): Promise<ProviderRepositoryPage> {
  const perPage = 30;
  const params = new URLSearchParams({ per_page: String(perPage), page: String(page) });
  if (input.provider === 'gitlab') {
    params.set('membership', 'true');
    params.set('min_access_level', '40');
    params.set('simple', 'true');
    params.set('order_by', 'last_activity_at');
    params.set('sort', 'desc');
    if (search) params.set('search', search);
  } else {
    params.set('affiliation', 'owner,collaborator,organization_member');
    params.set('sort', 'pushed');
    params.set('direction', 'desc');
  }
  const endpoint = input.provider === 'github' ? '/user/repos' : '/projects';
  const response = await providerRequest(input, `${endpoint}?${params}`);
  const body: unknown = await response.json();
  if (!Array.isArray(body))
    throw new HttpError(502, `${input.provider} returned an invalid repository list`);
  const map = input.provider === 'github' ? githubRepository : gitlabRepository;
  let repositories = body.map(map).filter((repo): repo is ProviderRepository => repo !== null);
  if (input.provider === 'github' && search) {
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
    input.provider === 'github'
      ? `/repositories/${encodeURIComponent(externalId)}`
      : `/projects/${encodeURIComponent(externalId)}`;
  const response = await providerRequest(input, endpoint);
  const repository =
    input.provider === 'github'
      ? githubRepository(await response.json())
      : gitlabRepository(await response.json());
  if (!repository) throw new HttpError(400, 'Repository is unavailable or cannot manage webhooks');
  return repository;
}

function githubRepoPath(fullName: string): string {
  const parts = fullName.split('/');
  if (parts.length !== 2 || parts.some((part) => !part))
    throw new HttpError(400, 'Invalid repository name');
  return `/repos/${parts.map(encodeURIComponent).join('/')}`;
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
        enable_ssl_verification: true,
      }),
    });
    const id = record(await response.json())?.id;
    if (typeof id !== 'number' && typeof id !== 'string')
      throw new HttpError(502, 'GitLab returned an invalid webhook');
    return String(id);
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
      events: ['pull_request'],
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
      : `${githubRepoPath(repository.fullName)}/hooks/${encodeURIComponent(webhookExternalId)}`;
  await providerRequest(input, path, { method: 'DELETE' });
}
