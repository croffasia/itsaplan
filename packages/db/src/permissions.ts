// Permission model for team roles. A role carries a matrix: for each resource the
// create/edit/read/delete flags. The matrix is stored as jsonb on team_role and
// enforced by the API (apps/api/src/shared/access.ts). Owners bypass the matrix
// entirely (full access). It lives here because both the API and the sign-up hook
// in @repo/auth, which seeds a new team's default role, write it.

export const PERMISSION_RESOURCES = [
  'work_items',
  'initiatives',
  'cycles',
  'dashboards',
  'documents',
  'views',
  'members_invite',
  'members_manage',
  'states',
  'issue_types',
  'labels',
  'ai_agents',
  'integrations',
  'agent_skills',
  'agent_tools',
  'custom_fields',
  'issue_templates',
  'workflow_config',
  'actions',
  'webhooks',
  'note_boards',
  'danger_zone',
] as const;
export type PermissionResource = (typeof PERMISSION_RESOURCES)[number];

export const PERMISSION_ACTIONS = ['create', 'edit', 'read', 'delete'] as const;
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

export type ResourcePermissions = Record<PermissionAction, boolean>;
export type Permissions = Record<PermissionResource, ResourcePermissions>;

// Resources that do not carry the whole CRUD set: the danger zone is the project's
// settings page and its deletion, the workflow config is read and written, an invite
// is created and revoked but never edited. A resource left out here supports every
// action. Unsupported cells stay present and false, so a caller reads any cell
// without a lookup.
const RESOURCE_ACTIONS: Partial<Record<PermissionResource, readonly PermissionAction[]>> = {
  danger_zone: ['read', 'delete'],
  workflow_config: ['read', 'edit'],
  members_invite: ['read', 'create', 'delete'],
};

export function resourceActions(resource: PermissionResource): readonly PermissionAction[] {
  return RESOURCE_ACTIONS[resource] ?? PERMISSION_ACTIONS;
}

function allowAll(resource: PermissionResource): ResourcePermissions {
  const allowed = resourceActions(resource);
  return Object.fromEntries(
    PERMISSION_ACTIONS.map((a) => [a, allowed.includes(a)]),
  ) as ResourcePermissions;
}

function denyAll(): ResourcePermissions {
  return { create: false, edit: false, read: false, delete: false };
}

// All flags false — the base a normalizer starts from.
export function emptyPermissions(): Permissions {
  return Object.fromEntries(PERMISSION_RESOURCES.map((r) => [r, denyAll()])) as Permissions;
}

// Every supported action allowed — the effective matrix for an owner (owners bypass
// checks, but this is returned so a member context always carries a resolved matrix).
export function fullPermissions(): Permissions {
  return Object.fromEntries(PERMISSION_RESOURCES.map((r) => [r, allowAll(r)])) as Permissions;
}

// The default "Member" role every team is created with. A role a team already had
// when migration 0115 moved it there keeps the matrix it was written with, which
// granted neither members_manage.read nor members_invite.read.
export function defaultMemberPermissions(): Permissions {
  const p = emptyPermissions();
  for (const r of ['work_items', 'initiatives', 'cycles', 'documents', 'note_boards'] as const) {
    p[r] = allowAll(r);
  }
  p.dashboards.read = true;
  p.views.read = true;
  p.states.read = true;
  p.issue_types.read = true;
  p.labels.read = true;
  p.ai_agents.read = true;
  p.custom_fields.read = true;
  p.issue_templates.read = true;
  p.members_manage.read = true;
  p.members_invite.read = true;
  return p;
}

// Coerces arbitrary input (a jsonb blob or a request body) into the canonical
// matrix: every resource and action present, values coerced to booleans, unknown
// keys dropped, missing entries and actions the resource does not support
// defaulted to false.
export function normalizePermissions(input: unknown): Permissions {
  const out = emptyPermissions();
  if (!input || typeof input !== 'object') return out;
  const src = input as Record<string, unknown>;
  for (const resource of PERMISSION_RESOURCES) {
    const entry = src[resource];
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    for (const action of resourceActions(resource)) {
      out[resource][action] = e[action] === true;
    }
  }
  return out;
}

export function hasPermission(
  permissions: Permissions,
  resource: PermissionResource,
  action: PermissionAction,
): boolean {
  return permissions[resource]?.[action] === true;
}
