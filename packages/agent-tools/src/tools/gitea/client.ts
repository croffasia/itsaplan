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
      return 'Repository or issue not found. Check the owner/repo spelling and that the token can read the repository.';
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

// The bare number of an issue. A model passes the number bare, with a # prefix, or as
// the issue URL it was given; all three are accepted.
export function issueRef(raw: unknown): number {
  const value = String(raw ?? '').trim();
  const match = value.match(/(\d+)\s*$/);
  if (!match) throw new Error(`"${value}" is not a Gitea issue number or URL.`);
  return Number(match[1]);
}

// Calls a Gitea endpoint and returns its parsed body. `path` is everything after
// /api/v1/, query string included.
export async function giteaRequest<T = Record<string, unknown>>(
  credential: ToolConfig,
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const { baseUrl, token } = giteaCredential(credential);
  const res = await fetch(`${baseUrl}/api/v1/${path}`, {
    method,
    headers: {
      Authorization: `token ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const raw = await res.text();
  let parsed: GiteaResponse = {};
  try {
    parsed = raw ? (JSON.parse(raw) as GiteaResponse) : {};
  } catch {
    /* non-JSON error page */
  }
  if (!res.ok) throw new Error(explain(res.status, parsed.message));
  return parsed as T;
}
