import { pinnedFetch, UrlNotAllowedError } from '@repo/net';
import { z } from 'zod';
import type { ToolConfig } from '../../types';

// GitLab REST API v4 client for gitlab.com, GitLab Self-Managed and GitLab Dedicated.
// Failures are turned into messages a person can act on, because a tool error goes
// straight to the model.

export interface GitlabIssue {
  iid?: number;
  title?: string;
  state?: string;
  web_url?: string;
  updated_at?: string;
  labels?: string[];
  [key: string]: unknown;
}

export interface GitlabMergeRequest {
  iid?: number;
  title?: string;
  description?: string | null;
  state?: string;
  draft?: boolean;
  detailed_merge_status?: string;
  has_conflicts?: boolean;
  author?: { username?: string } | null;
  source_branch?: string;
  target_branch?: string;
  sha?: string;
  changes_count?: string | null;
  web_url?: string;
  updated_at?: string;
  diff_refs?: { base_sha?: string; start_sha?: string; head_sha?: string } | null;
}

interface GitlabResponse {
  message?: string | Record<string, unknown>;
  error?: string;
  error_description?: string;
  scope?: string;
  [key: string]: unknown;
}

// The API root of the credential's instance. A self-managed instance can sit under a
// path, such as https://example.com/gitlab, so the path is kept.
export function apiRoot(credential: ToolConfig): string {
  const base = String(credential.baseUrl ?? '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/api\/v4$/, '');
  return `${base || 'https://gitlab.com'}/api/v4`;
}

// A project is addressed by its numeric ID or by its full path, which is sent as one
// encoded segment, as GitLab requires.
export function projectPath(project: unknown): string {
  const value = String(project ?? '')
    .trim()
    .replace(/^\/+|\/+$/g, '');
  if (!value) throw new Error('No GitLab project given.');
  return `projects/${encodeURIComponent(value)}`;
}

export const projectInput = z
  .union([z.string().min(1), z.number().int()])
  .describe('Project path with its group, such as group/subgroup/project, or the project ID.');

export const issueInput = z
  .union([z.number(), z.string()])
  .describe('Issue number (the #number GitLab shows), #number, or the issue URL.');

export const mergeRequestInput = z
  .union([z.number(), z.string()])
  .describe('Merge request number (the !number GitLab shows), !number, or the merge request URL.');

// The project-scoped number (iid) of an issue. A model passes it bare, with a # prefix,
// or as the issue URL, which GitLab also serves under /-/work_items/ and which can
// carry a #note_ anchor with digits of its own.
export function issueRef(raw: unknown): number {
  const value = String(raw ?? '').trim();
  const match = value.match(/^#?(\d+)$/) ?? value.match(/\/-\/(?:issues|work_items)\/(\d+)/);
  if (!match) throw new Error(`"${value}" is not a GitLab issue number or URL.`);
  return Number(match[1]);
}

// The iid of a merge request, bare, with the ! prefix GitLab writes it with, or from its
// URL.
export function mergeRequestRef(raw: unknown): number {
  const value = String(raw ?? '').trim();
  const match = value.match(/^!?(\d+)$/) ?? value.match(/\/-\/merge_requests\/(\d+)/);
  if (!match) throw new Error(`"${value}" is not a GitLab merge request number or URL.`);
  return Number(match[1]);
}

// A failed call, with the status the tools that need it read.
export class GitlabError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

// GitLab answers a failure with { message } as a string, or as an object of field
// errors on a validation failure, or with { error }, which an insufficient scope also
// carries with the scopes that would do.
function causes(body: GitlabResponse): string {
  const { message } = body;
  const parts: string[] = [];
  if (typeof message === 'string') parts.push(message);
  else if (message && typeof message === 'object') {
    for (const [field, errors] of Object.entries(message)) {
      parts.push(`${field} ${Array.isArray(errors) ? errors.join(', ') : String(errors)}`);
    }
  }
  if (body.error_description) parts.push(body.error_description);
  else if (body.error) parts.push(body.error);
  if (body.scope) parts.push(`accepted scopes: ${body.scope}`);
  return parts.join('; ');
}

export const MOVED = 'The project was renamed or moved. Use its current path or its project ID.';

function explain(res: Response, body: GitlabResponse): string {
  const message = causes(body);
  const detail = message ? `: ${message}` : '';
  switch (res.status) {
    // A GET on the old path of a moved project answers 301, any other method 405.
    case 301:
      return MOVED;
    case 405:
      return /moved projects/i.test(message)
        ? MOVED
        : `GitLab does not allow this action now${detail}`;
    case 401:
      return `The GitLab token is invalid, expired or revoked, or lacks permission for this action${detail}`;
    case 403:
      return `The GitLab token lacks permission for this action${detail}`;
    case 404:
      return 'Project, issue or merge request not found. Check the project path and that the token can access the project: GitLab answers 404 for a private project the token cannot see.';
    case 429: {
      const retryAfter = res.headers.get('retry-after');
      return `GitLab rate limit reached. ${retryAfter ? `Retry after ${retryAfter} seconds.` : 'Retry after at least a minute.'}`;
    }
    case 400:
    case 422:
      return `GitLab rejected the request as invalid${detail}`;
    default:
      return `GitLab API error (${res.status})${detail}`;
  }
}

// Calls an endpoint and returns its parsed body. `path` is everything after /api/v4/,
// query string included. The address is the credential's, so the call goes through the
// SSRF guard; redirects are not followed.
export async function gitlabRequest<T = Record<string, unknown>>(
  credential: ToolConfig,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const token = credential.token ? String(credential.token) : '';
  if (!token) throw new Error('No GitLab token configured.');
  let res: Response;
  try {
    res = await pinnedFetch(`${apiRoot(credential)}/${path}`, {
      method,
      headers: {
        'PRIVATE-TOKEN': token,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      timeoutMs: 15_000,
    });
  } catch (err) {
    if (err instanceof UrlNotAllowedError) {
      throw new Error(
        `The GitLab address is not allowed (${err.message}). An instance on a private network has to be named in SSRF_ALLOWED_HOSTS on the instance.`,
      );
    }
    throw err;
  }
  const raw = await res.text();
  let parsed: GitlabResponse = {};
  try {
    parsed = raw ? (JSON.parse(raw) as GitlabResponse) : {};
  } catch {
    /* non-JSON error page */
  }
  if (!res.ok) throw new GitlabError(explain(res, parsed), res.status);
  return parsed as T;
}

// GitLab names an open issue or merge request "opened"; the tools say "open", as the
// other git hosts do.
export const STATES = { open: 'opened', closed: 'closed', merged: 'merged', all: 'all' } as const;

export function stateOf(item: { state?: string }): string | null {
  return item.state === 'opened' ? 'open' : (item.state ?? null);
}
