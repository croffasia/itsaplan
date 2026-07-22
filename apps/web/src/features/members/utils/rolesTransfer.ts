// Serialize/parse a project's custom roles for the copy/paste transfer between
// projects. The clipboard payload is a small JSON envelope; parsing validates it and
// normalizes each role's matrix against the permission catalog so an import stays
// robust across catalog changes. Default roles are never included — they are managed
// per project, not transferred.

import type {
  PermissionAction,
  PermissionCatalog,
  PermissionResource,
  Permissions,
  Role,
} from '@/lib/api';

const PAYLOAD_TYPE = 'plan.roles';
const PAYLOAD_VERSION = 1;

export interface RoleTransfer {
  name: string;
  permissions: Permissions;
}

interface RolesEnvelope {
  type: typeof PAYLOAD_TYPE;
  version: number;
  roles: RoleTransfer[];
}

// A parsed role paired with what applying it would do to the current project.
export interface PlannedRole extends RoleTransfer {
  // 'create' — no role with this name yet. 'update' — a custom role with this name is
  // overwritten. 'skip' — a default role has this name and is left untouched.
  action: 'create' | 'update' | 'skip';
  existingId?: number;
}

// The clipboard text for the project's non-default roles.
export function serializeRoles(roles: Role[]): string {
  const envelope: RolesEnvelope = {
    type: PAYLOAD_TYPE,
    version: PAYLOAD_VERSION,
    roles: roles
      .filter((r) => !r.isDefault)
      .map((r) => ({ name: r.name, permissions: r.permissions })),
  };
  return JSON.stringify(envelope, null, 2);
}

// Builds a full matrix from the catalog, reading each flag from the input and
// defaulting anything missing (or non-boolean) to false. Unknown resources/actions in
// the input are dropped.
function normalizeMatrix(input: unknown, catalog: PermissionCatalog): Permissions {
  const src = (input && typeof input === 'object' ? input : {}) as Record<
    string,
    Record<string, unknown>
  >;
  const out = {} as Permissions;
  for (const resource of catalog.resources) {
    const row = {} as Record<PermissionAction, boolean>;
    for (const action of catalog.actions) {
      row[action] = src[resource]?.[action] === true;
    }
    out[resource as PermissionResource] = row;
  }
  return out;
}

// Parses clipboard text into normalized roles, or throws with a user-facing message.
export function parseRolesText(text: string, catalog: PermissionCatalog): RoleTransfer[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Clipboard does not contain valid JSON.');
  }
  const env = data as Partial<RolesEnvelope>;
  if (!env || env.type !== PAYLOAD_TYPE || !Array.isArray(env.roles)) {
    throw new Error('Clipboard does not contain a roles export.');
  }
  const roles: RoleTransfer[] = [];
  const seen = new Set<string>();
  for (const raw of env.roles) {
    const name = typeof raw?.name === 'string' ? raw.name.trim() : '';
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    roles.push({ name, permissions: normalizeMatrix(raw.permissions, catalog) });
  }
  if (roles.length === 0) throw new Error('The roles export is empty.');
  return roles;
}

// Decides what applying each incoming role does against the current roles, matching
// by name (case-insensitive). A default role with the same name is skipped.
export function planRolesImport(incoming: RoleTransfer[], existing: Role[]): PlannedRole[] {
  const byName = new Map(existing.map((r) => [r.name.toLowerCase(), r]));
  return incoming.map((role) => {
    const match = byName.get(role.name.toLowerCase());
    if (!match) return { ...role, action: 'create' };
    if (match.isDefault) return { ...role, action: 'skip', existingId: match.id };
    return { ...role, action: 'update', existingId: match.id };
  });
}
