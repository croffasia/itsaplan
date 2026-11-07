import { pinnedFetch, UrlNotAllowedError } from '@repo/net';
import { z } from 'zod';
import type { ToolConfig } from '../../types';

// GitHub API client for github.com, GitHub Enterprise Cloud with data residency
// (GHE.com) and GitHub Enterprise Server. Issues go through the REST API, discussions
// through GraphQL, which is the only API GitHub offers for them. Failures are turned
// into messages a person can act on, because a tool error goes straight to the model.

// The newer 2026-03-10 is unknown to GitHub Enterprise Server before 3.22, which
// answers it with 410.
const API_VERSION = '2022-11-28';

export interface GithubIssue {
  number?: number;
  title?: string;
  state?: string;
  html_url?: string;
  updated_at?: string;
  labels?: (string | { name?: string })[];
  pull_request?: unknown;
  [key: string]: unknown;
}

interface GithubResponse {
  message?: string;
  errors?: { field?: string; code?: string; message?: string; type?: string }[];
  data?: unknown;
  [key: string]: unknown;
}

// The REST API root for the credential's host. github.com serves it from
// api.github.com, a GHE.com subdomain from api.SUBDOMAIN.ghe.com, and an Enterprise
// Server instance from /api/v3 on its own host.
export function apiRoot(credential: ToolConfig): string {
  const raw = String(credential.baseUrl ?? '').trim();
  if (!raw) return 'https://api.github.com';
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`"${raw}" is not a valid GitHub address.`);
  }
  const host = url.hostname.toLowerCase();
  if (host === 'github.com' || host === 'api.github.com') return 'https://api.github.com';
  if (host.endsWith('.ghe.com')) return `https://api.${host.replace(/^api\./, '')}`;
  return `${url.origin}/api/v3`;
}

// The GraphQL endpoint sits beside the REST root, except on an Enterprise Server,
// where it is /api/graphql rather than /api/v3/graphql.
export function graphqlUrl(credential: ToolConfig): string {
  return `${apiRoot(credential).replace(/\/v3$/, '')}/graphql`;
}

// The owner/repo part of an endpoint path, encoded so a stray slash cannot redirect
// the call to another repository.
export function repoPath(owner: unknown, repo: unknown): string {
  return `repos/${encodeURIComponent(String(owner))}/${encodeURIComponent(String(repo))}`;
}

export const repoInput = {
  owner: z.string().min(1).describe('Repository owner (user or organization).'),
  repo: z.string().min(1).describe('Repository name.'),
};

export const issueInput = z
  .union([z.number(), z.string()])
  .describe('Issue number, #number, or the issue URL.');

export const discussionInput = z
  .union([z.number(), z.string()])
  .describe('Discussion number, #number, or the discussion URL.');

const REF_PATHS = { issue: 'issues|pull', discussion: 'discussions' };

// The bare number of an issue or a discussion. A model passes the number bare, with a
// # prefix, or as the URL it was given, which can carry a comment anchor with digits of
// its own; all three are accepted.
export function numberRef(raw: unknown, kind: keyof typeof REF_PATHS): number {
  const value = String(raw ?? '').trim();
  const match =
    value.match(/^#?(\d+)$/) ?? value.match(new RegExp(`/(?:${REF_PATHS[kind]})/(\\d+)`));
  if (!match) throw new Error(`"${value}" is not a GitHub ${kind} number or URL.`);
  return Number(match[1]);
}

// What GitHub said went wrong: the message of a REST error with the causes of a 422,
// or the messages of a GraphQL errors array.
function causes(body: GithubResponse): string {
  const errors = (body.errors ?? []).map(
    (e) => e.message ?? [e.field, e.code].filter(Boolean).join(' '),
  );
  return [body.message, ...errors].filter(Boolean).join('; ');
}

// A primary rate limit answers 403 or 429 over REST and 200 with an error over
// GraphQL, with x-ratelimit-remaining at 0 either way. A secondary limit answers 403
// or 429 with retry-after or only its message; without retry-after GitHub asks to
// wait at least a minute, since x-ratelimit-reset belongs to the primary limit.
function rateLimit(res: Response, body: GithubResponse): string | null {
  const exhausted = res.headers.get('x-ratelimit-remaining') === '0';
  const limited =
    res.status === 429 ||
    (res.status === 403 &&
      (exhausted || res.headers.has('retry-after') || /rate limit/i.test(body.message ?? ''))) ||
    (res.ok && (exhausted || (body.errors ?? []).some((e) => e.type === 'RATE_LIMITED')));
  if (!limited) return null;
  const detail = causes(body);
  const retryAfter = res.headers.get('retry-after');
  const reset = Number(res.headers.get('x-ratelimit-reset'));
  let when = 'Retry after at least a minute.';
  if (retryAfter) when = `Retry after ${retryAfter} seconds.`;
  else if (exhausted && reset) when = `Retry after ${new Date(reset * 1000).toISOString()}.`;
  return `GitHub rate limit reached${detail ? `: ${detail}` : ''}. ${when}`;
}

function explain(res: Response, body: GithubResponse): string {
  const limited = rateLimit(res, body);
  if (limited) return limited;
  const message = causes(body);
  const detail = message ? `: ${message}` : '';
  switch (res.status) {
    // A renamed repository answers 301 or 307 depending on the method; 301 on an
    // issue also means it was moved to another repository.
    case 301:
    case 307:
      return 'The repository was renamed or transferred, or the issue was moved to another repository. Use the current owner, name and number.';
    case 401:
      return `The GitHub token is invalid, expired, or was revoked${detail}`;
    case 403:
      return `The GitHub token lacks permission for this action${detail}`;
    case 404:
      return 'Repository or issue not found. Check the owner/repo spelling and that the token can access the repository: GitHub answers 404 for a private repository the token cannot see.';
    case 410:
      return `The issue was deleted, or issues are disabled in this repository${detail}`;
    case 422:
      return `GitHub rejected the request as invalid${detail}`;
    default:
      return `GitHub API error (${res.status})${detail}`;
  }
}

// Sends one call to the credential's host. The address is the credential's, so the
// call goes through the SSRF guard; redirects are not followed.
async function send(
  credential: ToolConfig,
  method: 'GET' | 'POST' | 'PATCH',
  url: string,
  headers: Record<string, string>,
  body?: Record<string, unknown>,
): Promise<{ res: Response; parsed: GithubResponse }> {
  const token = credential.token ? String(credential.token) : '';
  if (!token) throw new Error('No GitHub token configured.');
  let res: Response;
  try {
    res = await pinnedFetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': 'itsaplan',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      timeoutMs: 15_000,
    });
  } catch (err) {
    if (err instanceof UrlNotAllowedError) {
      throw new Error(
        `The GitHub address is not allowed (${err.message}). A GitHub Enterprise Server on a private network has to be named in SSRF_ALLOWED_HOSTS on the instance.`,
      );
    }
    throw err;
  }
  const raw = await res.text();
  let parsed: GithubResponse = {};
  try {
    parsed = raw ? (JSON.parse(raw) as GithubResponse) : {};
  } catch {
    /* non-JSON error page */
  }
  return { res, parsed };
}

// Calls a REST endpoint and returns its parsed body. `path` is everything after the
// API root, query string included.
export async function githubRequest<T = Record<string, unknown>>(
  credential: ToolConfig,
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const { res, parsed } = await send(
    credential,
    method,
    `${apiRoot(credential)}/${path}`,
    { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': API_VERSION },
    body,
  );
  if (!res.ok) throw new Error(explain(res, parsed));
  return parsed as T;
}

// Runs a GraphQL query or mutation and returns its data. GraphQL answers a failed
// call, a missing repository included, with 200 and an errors array.
export async function githubGraphql<T>(
  credential: ToolConfig,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const { res, parsed } = await send(
    credential,
    'POST',
    graphqlUrl(credential),
    {},
    {
      query,
      variables,
    },
  );
  if (!res.ok) throw new Error(explain(res, parsed));
  if (parsed.errors?.length) {
    throw new Error(rateLimit(res, parsed) ?? `GitHub rejected the request: ${causes(parsed)}`);
  }
  return parsed.data as T;
}

// The node id of a discussion, which every discussion mutation takes, from the number
// a person knows it by.
export async function discussionId(
  credential: ToolConfig,
  owner: unknown,
  repo: unknown,
  ref: unknown,
): Promise<string> {
  const number = numberRef(ref, 'discussion');
  const data = await githubGraphql<{ repository: { discussion: { id: string } | null } | null }>(
    credential,
    `query($owner: String!, $repo: String!, $number: Int!) {
      repository(owner: $owner, name: $repo) { discussion(number: $number) { id } }
    }`,
    { owner: String(owner), repo: String(repo), number },
  );
  const id = data.repository?.discussion?.id;
  if (!id) throw new Error(`Discussion #${number} not found in ${owner}/${repo}.`);
  return id;
}
