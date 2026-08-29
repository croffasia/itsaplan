import { HttpError } from '#shared/lib';

// SCIM 2.0 representation: the JSON shapes of RFC 7643, the filter and PATCH
// grammar of RFC 7644, and the mapping between them and this app's DTOs.
//
// The account's email comes from the `emails` attribute, not `userName`: RFC 7643
// does not require `userName` to be an email address, and some directories set it
// to a login id that is not one, while `emails` is what SCIM actually calls an
// email. `userName` is read only as a fallback, for a provider that omits `emails`
// altogether. `user.username` (the app's own handle, used in @mentions) is a
// different thing entirely and is derived at creation — SCIM never sets it.

const API_URL = process.env.API_URL ?? '';

export const SCIM_PREFIX = '/scim/v2';

export const SCIM_BASE_URL = `${API_URL}${SCIM_PREFIX}`;

export const SCIM_CONTENT_TYPE = 'application/scim+json';

const USER_SCHEMA = 'urn:ietf:params:scim:schemas:core:2.0:User';
const GROUP_SCHEMA = 'urn:ietf:params:scim:schemas:core:2.0:Group';
const LIST_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:ListResponse';
const ERROR_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:Error';
const PATCH_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:PatchOp';

// A SCIM failure. `scimType` is the machine-readable reason from RFC 7644 §3.12;
// provisioning clients branch on it, so it is carried alongside the status.
export class ScimError extends HttpError {
  readonly scimType?: string;

  constructor(status: number, detail: string, scimType?: string) {
    super(status, detail);
    this.scimType = scimType;
  }
}

export function scimErrorBody(status: number, detail: string, scimType?: string) {
  return {
    schemas: [ERROR_SCHEMA],
    // The status is a string in SCIM, unlike everywhere else in this API.
    status: String(status),
    ...(scimType ? { scimType } : {}),
    detail,
  };
}

// ── Users ─────────────────────────────────────────────────────────────────────

export interface ScimUserRecord {
  id: string;
  email: string;
  name: string;
  active: boolean;
  externalId: string | null;
  createdAt: string;
  updatedAt: string;
}

// SCIM splits a name into parts, the app stores one string. The first word is the
// given name and the rest the family name, which is the reverse of how a create
// request is folded back together.
export function splitName(name: string): { givenName: string; familyName: string } {
  const trimmed = name.trim();
  const gap = trimmed.indexOf(' ');
  if (gap === -1) return { givenName: trimmed, familyName: '' };
  return { givenName: trimmed.slice(0, gap), familyName: trimmed.slice(gap + 1) };
}

export function joinName(
  parts: { givenName?: string; familyName?: string; formatted?: string } | undefined,
  fallback: string,
): string {
  if (parts?.formatted?.trim()) return parts.formatted.trim();
  const joined = [parts?.givenName, parts?.familyName]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(' ');
  return joined || fallback;
}

// The address a create or replace request assigns as the account's email. `emails`
// is preferred; `userName` is read only when a provider sends no `emails` at all,
// and is then checked for an "@" so a bare login id is refused rather than written
// into `user.email`, where it would break sign-in and password reset links that
// assume the value is a real address.
export function readAccountEmail(doc: Record<string, unknown>): string {
  if (doc.emails !== undefined) return readEmail(doc.emails);
  if (typeof doc.userName === 'string' && doc.userName.trim()) {
    const userName = doc.userName.trim();
    if (!userName.includes('@')) {
      throw new ScimError(400, 'userName is not an email address', 'invalidValue');
    }
    return userName;
  }
  throw new ScimError(400, 'userName or emails is required', 'invalidValue');
}

// One address out of a multi-valued `emails` attribute: the one marked primary, or
// the first. Entries may be objects or bare strings.
export function readEmail(value: unknown): string {
  const list = Array.isArray(value) ? value : [value];
  const entries = list.map((entry) =>
    typeof entry === 'string'
      ? { value: entry, primary: false }
      : (entry as Record<string, unknown>),
  );
  const chosen = entries.find((e) => e?.primary === true) ?? entries[0];
  return asString(chosen?.value, 'email address');
}

export function toScimUser(record: ScimUserRecord) {
  return {
    schemas: [USER_SCHEMA],
    id: record.id,
    ...(record.externalId ? { externalId: record.externalId } : {}),
    userName: record.email,
    name: { ...splitName(record.name), formatted: record.name },
    displayName: record.name,
    emails: [{ value: record.email, primary: true, type: 'work' }],
    active: record.active,
    meta: {
      resourceType: 'User',
      created: record.createdAt,
      lastModified: record.updatedAt,
      location: `${SCIM_BASE_URL}/Users/${record.id}`,
    },
  };
}

// ── Groups ────────────────────────────────────────────────────────────────────

export interface ScimGroupRecord {
  id: string;
  displayName: string;
  externalId: string | null;
  members: { userId: string; name: string }[];
  createdAt: string;
  updatedAt: string;
}

export function toScimGroup(record: ScimGroupRecord) {
  return {
    schemas: [GROUP_SCHEMA],
    id: record.id,
    ...(record.externalId ? { externalId: record.externalId } : {}),
    displayName: record.displayName,
    members: record.members.map((m) => ({
      value: m.userId,
      display: m.name,
      $ref: `${SCIM_BASE_URL}/Users/${m.userId}`,
    })),
    meta: {
      resourceType: 'Group',
      created: record.createdAt,
      lastModified: record.updatedAt,
      location: `${SCIM_BASE_URL}/Groups/${record.id}`,
    },
  };
}

// ── List response ─────────────────────────────────────────────────────────────

export function toListResponse<T>(resources: T[], total: number, startIndex: number) {
  return {
    schemas: [LIST_SCHEMA],
    totalResults: total,
    startIndex,
    itemsPerPage: resources.length,
    Resources: resources,
  };
}

// ── Filters ───────────────────────────────────────────────────────────────────

// Only `<attribute> eq "<value>"` is understood. That is what Okta, Entra and
// Authentik send to find an existing resource before creating one, and it is what
// ServiceProviderConfig advertises. Anything richer is refused rather than
// silently ignored, which would return the wrong resource.
const EQ_FILTER = /^\s*([\w.]+)\s+eq\s+"((?:[^"\\]|\\.)*)"\s*$/i;

export interface ScimFilter {
  attribute: string;
  value: string;
}

export function parseFilter(filter: string | undefined, allowed: string[]): ScimFilter | null {
  if (!filter) return null;
  const match = EQ_FILTER.exec(filter);
  if (!match) {
    throw new ScimError(
      400,
      `Only '<attribute> eq "<value>"' filters are supported`,
      'invalidFilter',
    );
  }
  const attribute = match[1]!.toLowerCase();
  if (!allowed.some((a) => a.toLowerCase() === attribute)) {
    throw new ScimError(
      400,
      `Filtering on '${match[1]}' is not supported. Supported: ${allowed.join(', ')}`,
      'invalidFilter',
    );
  }
  return { attribute, value: match[2]!.replace(/\\(.)/g, '$1') };
}

// ── PATCH ─────────────────────────────────────────────────────────────────────

export interface ScimPatchOperation {
  op: 'add' | 'replace' | 'remove';
  path?: string;
  value?: unknown;
}

// Normalises a PatchOp body into operations with a lower-cased op. Entra sends a
// path-less `replace` whose value is an object of attributes, which is expanded
// here into one operation per attribute so callers handle a single shape.
export function parsePatch(body: unknown): ScimPatchOperation[] {
  const doc = body as { schemas?: unknown; Operations?: unknown } | null;
  const schemas = Array.isArray(doc?.schemas) ? doc.schemas : [];
  if (!schemas.includes(PATCH_SCHEMA)) {
    throw new ScimError(400, `Body must carry the ${PATCH_SCHEMA} schema`, 'invalidSyntax');
  }
  if (!Array.isArray(doc?.Operations)) {
    throw new ScimError(400, 'Body must carry an Operations array', 'invalidSyntax');
  }

  const out: ScimPatchOperation[] = [];
  for (const raw of doc.Operations) {
    const entry = raw as { op?: unknown; path?: unknown; value?: unknown };
    const op = String(entry.op ?? '').toLowerCase();
    if (op !== 'add' && op !== 'replace' && op !== 'remove') {
      throw new ScimError(400, `Unsupported operation '${entry.op}'`, 'invalidSyntax');
    }
    const path = typeof entry.path === 'string' ? entry.path : undefined;
    if (!path && op !== 'remove' && entry.value && typeof entry.value === 'object') {
      for (const [key, value] of Object.entries(entry.value as Record<string, unknown>)) {
        out.push({ op, path: key, value });
      }
      continue;
    }
    if (!path) throw new ScimError(400, `Operation '${op}' needs a path`, 'noTarget');
    out.push({ op, path, value: entry.value });
  }
  return out;
}

// SCIM sends booleans as booleans, but some clients send them as strings.
export function asBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  throw new ScimError(400, `Expected a boolean, got ${JSON.stringify(value)}`, 'invalidValue');
}

export function asString(value: unknown, what: string): string {
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  throw new ScimError(400, `Expected a non-empty ${what}`, 'invalidValue');
}

// A member list as PATCH sends it: `[{ value: "<user id>" }]`, or a bare id.
export function memberIds(value: unknown): string[] {
  const list = Array.isArray(value) ? value : [value];
  return list.map((entry) => {
    if (typeof entry === 'string') return entry;
    const id = (entry as { value?: unknown } | null)?.value;
    return asString(id, 'member id');
  });
}

const MEMBER_PATH_FILTER = /^members\[(.+)]$/i;
const VALUE_EQ = /value\s+eq\s+"((?:[^"\\]|\\.)*)"/gi;

// RFC 7644 §3.5.2.2's canonical way to remove one group member puts the id in a
// filter on the path itself — `path: 'members[value eq "<id>"]'`, no `value` — which
// is what Okta sends. Returns null for the other shape, `path: 'members'` with the
// id(s) in `value` the ordinary way, so a caller can fall back to `memberIds`.
export function memberFilterIds(path: string): string[] | null {
  const match = MEMBER_PATH_FILTER.exec(path.trim());
  if (!match) return null;
  return [...match[1]!.matchAll(VALUE_EQ)].map((m) => m[1]!.replace(/\\(.)/g, '$1'));
}

// Group names out of a loosely-typed "which groups does this account belong to"
// value. Two shapes reach this: the `groups` attribute a SCIM User body can carry
// (RFC 7643 §4.1.2) — `{ value, display }` refs, where `display` is meant to be the
// human-readable name and `value` the provider's own opaque id, but a provider that
// skips Group resources entirely often has no `display` to send and puts the name
// in `value` instead — and an OIDC `groups` claim, which is conventionally a plain
// array of name strings. Both are accepted so the same sync feeds from either.
export function groupDisplayNames(value: unknown): string[] {
  if (value === undefined) return [];
  const list = Array.isArray(value) ? value : [value];
  const names = list
    .map((entry) => {
      if (typeof entry === 'string') return entry;
      const ref = entry as { display?: unknown; value?: unknown } | null;
      return ref?.display ?? ref?.value;
    })
    .filter((name): name is string => typeof name === 'string' && name.trim().length > 0)
    .map((name) => name.trim());
  return [...new Set(names)];
}
