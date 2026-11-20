import { pinnedFetch, UrlNotAllowedError } from '@repo/net';
import { z } from 'zod';
import type { ToolConfig } from '../../types';

// Baserow REST API client for Baserow Cloud and self-hosted instances. It authenticates
// with a database token, which reaches only the rows of the tables it was granted. Rows
// are read and written by field name (user_field_names), so the model never handles
// field_123 keys. Failures are turned into messages a person can act on, because a tool
// error goes straight to the model.

export interface BaserowRow {
  id: number;
  [field: string]: unknown;
}

interface BaserowResponse {
  error?: string;
  detail?: unknown;
  [key: string]: unknown;
}

// The cloud web app at baserow.io serves no API, so it maps to api.baserow.io. A
// self-hosted instance serves the API under /api on its own address.
export function apiRoot(credential: ToolConfig): string {
  const raw = String(credential.baseUrl ?? '').trim();
  if (!raw) return 'https://api.baserow.io';
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`"${raw}" is not a valid Baserow address.`);
  }
  const host = url.hostname.toLowerCase();
  if (host === 'baserow.io' || host === 'www.baserow.io') return 'https://api.baserow.io';
  return url.origin;
}

export function authHeader(credential: ToolConfig): string {
  const token = credential.token ? String(credential.token) : '';
  if (!token) throw new Error('No Baserow database token configured.');
  return `Token ${token}`;
}

// The bare id of a table or a row. A model passes the id, or the Baserow URL it was
// given: /database/1/table/2/3 for a table view, /database/1/table/2/3/row/4 for a row.
export function idRef(raw: unknown, kind: 'table' | 'row'): number {
  const value = String(raw ?? '').trim();
  const match = value.match(/^(\d+)$/) ?? value.match(new RegExp(`/${kind}/(\\d+)`));
  if (!match) throw new Error(`"${value}" is not a Baserow ${kind} id or URL.`);
  return Number(match[1]);
}

export const tableInput = z
  .union([z.number(), z.string()])
  .describe('Table id from baserow_list_tables, or the table URL.');

export const rowValues = z
  .record(z.string(), z.any())
  .describe(
    'Cell values keyed by field name, such as {"Name": "Acme", "Status": "Done"}. Take field and option names from baserow_list_fields. A date is an ISO string. A single_select takes the option name, a multiple_select an array of option names, a link_row an array of row ids or of the linked rows\' primary field values. A link_row array replaces the row\'s current links. Leave out read-only fields.',
  );

// A list of field names in the comma-separated form Baserow parses as CSV: each name
// is quoted, so a name with a comma or a quote stays one name.
export function fieldList(names: string[]): string {
  return names.map((name) => `"${name.replace(/[\\"]/g, '\\$&')}"`).join(',');
}

// A validation error carries its detail as an object of per-field messages.
function detailText(detail: unknown): string {
  if (!detail) return '';
  if (typeof detail === 'string') return detail;
  return JSON.stringify(detail).slice(0, 500);
}

function explain(status: number, body: BaserowResponse): string {
  const detail = detailText(body.detail);
  switch (body.error) {
    case 'ERROR_TOKEN_DOES_NOT_EXIST':
      return 'The Baserow database token is invalid or was deleted.';
    case 'ERROR_NO_PERMISSION_TO_TABLE':
      return 'The Baserow database token has no permission for this action on this table. Grant it in Baserow (My settings, Database tokens).';
  }
  if (status === 429) return 'Baserow rate limit reached. Retry in a few seconds.';
  const code = body.error ? ` ${body.error}` : '';
  return `Baserow API error (${status}${code})${detail ? `: ${detail}` : ''}`;
}

// Calls a Baserow endpoint and returns its parsed body. `path` is everything after
// /api/, query string included. The address may be the credential's own instance, so
// the call goes through the SSRF guard; redirects are not followed.
export async function baserowRequest<T = BaserowResponse>(
  credential: ToolConfig,
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  body?: unknown,
): Promise<T> {
  const authorization = authHeader(credential);
  let res: Response;
  try {
    res = await pinnedFetch(`${apiRoot(credential)}/api/${path}`, {
      method,
      headers: {
        Authorization: authorization,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      timeoutMs: 30_000,
    });
  } catch (err) {
    if (err instanceof UrlNotAllowedError) {
      throw new Error(
        `The Baserow address is not allowed (${err.message}). An instance on a private network has to be named in SSRF_ALLOWED_HOSTS on the instance.`,
      );
    }
    throw err;
  }
  const raw = await res.text();
  let parsed: BaserowResponse | undefined;
  try {
    parsed = raw ? (JSON.parse(raw) as BaserowResponse) : {};
  } catch {
    /* non-JSON page */
  }
  if (!res.ok) throw new Error(explain(res.status, parsed ?? {}));
  // A wrong instance URL often answers 200 with the web app's HTML.
  if (!parsed) {
    throw new Error(
      'The Baserow address answered with a web page instead of the API. Check the instance URL.',
    );
  }
  return parsed as T;
}
