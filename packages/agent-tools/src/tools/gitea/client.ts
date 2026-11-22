import { pinnedFetch, ResponseTooLargeError, UrlNotAllowedError } from '@repo/net';
import { z } from 'zod';
import type { ToolConfig } from '../../types';

// Gitea REST API client, addressed at whatever instance the credential points at, so
// self-hosted installs and gitea.com work alike. Failures come back as a JSON
// { message }; the common statuses are turned into messages a person can act on,
// because a tool error goes straight to the model.

export interface GiteaIssue {
  number?: number;
  title?: string;
  state?: string;
  html_url?: string;
  updated_at?: string;
  labels?: { name?: string }[];
  [key: string]: unknown;
}

export interface GiteaPull {
  number?: number;
  title?: string;
  body?: string;
  state?: string;
  draft?: boolean;
  merged?: boolean;
  mergeable?: boolean;
  html_url?: string;
  updated_at?: string;
  user?: { login?: string } | null;
  head?: { ref?: string; sha?: string };
  base?: { ref?: string };
  additions?: number;
  deletions?: number;
  changed_files?: number;
}

interface GiteaResponse {
  message?: string;
  [key: string]: unknown;
}

function explain(status: number, message?: string): string {
  const detail = message ? `: ${message}` : '';
  switch (status) {
    case 401:
      return `The Gitea token is invalid or was revoked${detail}`;
    case 403:
      return `The Gitea token lacks permission for this action${detail}`;
    case 404:
      return 'Repository, issue or pull request not found. Check the owner/repo spelling and that the token can read the repository.';
    case 405:
      return `Gitea does not allow this action now${detail}`;
    case 409:
      return `Gitea reported a conflict${detail}`;
    case 422:
      return `Gitea rejected the request as invalid${detail}`;
    default:
      return `Gitea API error (${status})${detail}`;
  }
}

export function giteaCredential(credential: ToolConfig): { baseUrl: string; token: string } {
  const baseUrl = String(credential.baseUrl ?? '')
    .trim()
    .replace(/\/+$/, '');
  if (!baseUrl) throw new Error('No Gitea instance URL configured.');
  const token = credential.token ? String(credential.token) : '';
  if (!token) throw new Error('No Gitea token configured.');
  return { baseUrl, token };
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

export const pullInput = z
  .union([z.number(), z.string()])
  .describe('Pull request number, #number, or the pull request URL.');

// The bare number of an issue or a pull request, which share one numbering. A model
// passes the number bare, with a # prefix, or as the URL it was given, which can carry
// a comment anchor with digits of its own; all three are accepted.
export function numberRef(raw: unknown): number {
  const value = String(raw ?? '').trim();
  const match = value.match(/^#?(\d+)$/) ?? value.match(/\/(?:issues|pulls)\/(\d+)/);
  if (!match) throw new Error(`"${value}" is not a Gitea issue or pull request number or URL.`);
  return Number(match[1]);
}

// A failed call, with its status.
class GiteaError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

// Sends one call to the credential's instance. `path` is everything after /api/v1/,
// query string included. The address is the credential's, so the call goes through the
// SSRF guard; redirects are not followed.
async function send(
  credential: ToolConfig,
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  body?: Record<string, unknown>,
  maxBytes?: number,
): Promise<string> {
  const { baseUrl, token } = giteaCredential(credential);
  let res: Response;
  try {
    res = await pinnedFetch(`${baseUrl}/api/v1/${path}`, {
      method,
      headers: {
        Authorization: `token ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      timeoutMs: 15_000,
      maxBytes,
    });
  } catch (err) {
    if (err instanceof UrlNotAllowedError) {
      throw new Error(
        `The Gitea address is not allowed (${err.message}). An instance on a private network has to be named in SSRF_ALLOWED_HOSTS on the instance.`,
      );
    }
    throw err;
  }
  const raw = await res.text();
  if (!res.ok) {
    let parsed: GiteaResponse = {};
    try {
      parsed = raw ? (JSON.parse(raw) as GiteaResponse) : {};
    } catch {
      /* non-JSON error page */
    }
    throw new GiteaError(explain(res.status, parsed.message), res.status);
  }
  return raw;
}

// Calls a JSON endpoint and returns its parsed body.
export async function giteaRequest<T = Record<string, unknown>>(
  credential: ToolConfig,
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const raw = await send(credential, method, path, body);
  return (raw ? JSON.parse(raw) : {}) as T;
}

// Replying to and resolving a review comment arrived in Gitea 28. Forgejo and older Gitea
// answer 404 to them, as they do for a comment that does not exist, so the error names both.
export async function giteaReviewCommentRequest<T = Record<string, unknown>>(
  credential: ToolConfig,
  action: 'reply to' | 'resolve',
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  try {
    return await giteaRequest<T>(credential, 'POST', path, body);
  } catch (err) {
    if (err instanceof GiteaError && err.status === 404) {
      throw new Error(
        `The comment was not found, or the server cannot ${action} review comments over its API: that needs Gitea 28 or newer, and Forgejo does not offer it.`,
      );
    }
    throw err;
  }
}

const MAX_DIFF_MB = 10;

// Reads a pull request's diff. Gitea sends it whole, as large as what the author pushed,
// and it is held in memory, so it is capped.
export async function giteaDiff(credential: ToolConfig, path: string): Promise<string> {
  try {
    return await send(credential, 'GET', path, undefined, MAX_DIFF_MB * 1024 * 1024);
  } catch (err) {
    if (err instanceof ResponseTooLargeError) {
      throw new Error(`The diff is larger than ${MAX_DIFF_MB} MB. Read the pull request in Gitea.`);
    }
    throw err;
  }
}
