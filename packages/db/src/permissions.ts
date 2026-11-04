// Permission model for team roles. A role carries a matrix: for each resource the
// create/edit/read/delete flags. The matrix is stored as jsonb on team_role and
// enforced by the API (apps/api/src/shared/access.ts). Owners bypass the matrix
// entirely (full access).

const CORE_RESOURCES = [
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
  'agent_schedules',
  'integrations',
  'agent_skills',
  'agent_tools',
  'agent_usage',
  'custom_fields',
  'issue_templates',
  'workflow_config',
  'actions',
  'webhooks',
  'repositories',
  'note_boards',
  'import_export',
  'danger_zone',
] as const;
export type PermissionResource = (typeof CORE_RESOURCES)[number];

// The resources in the order a matrix lists them, with those setPermissionExtensions added.
export const PERMISSION_RESOURCES: PermissionResource[] = [...CORE_RESOURCES];

export const PERMISSION_ACTIONS = ['create', 'edit', 'read', 'delete'] as const;
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

export type ResourcePermissions = Record<PermissionAction, boolean>;
export type Permissions = Record<PermissionResource, ResourcePermissions>;

// Resources that do not carry the whole CRUD set: the danger zone is the project's
// settings page and its deletion, the workflow config is read and written, an invite
// is created and revoked but never edited, the repository settings are shown only to
// whoever may change them, and what the agents spent is only read. A resource left out
// here supports every action. Unsupported cells stay present and false, so a caller
// reads any cell without a lookup.
const RESOURCE_ACTIONS: Partial<Record<PermissionResource, readonly PermissionAction[]>> = {
  danger_zone: ['read', 'delete'],
  workflow_config: ['read', 'edit'],
  repositories: ['edit'],
  agent_usage: ['read'],
  members_invite: ['read', 'create', 'delete'],
};

// A resource a build splits out of one the core has.
export interface PermissionExtension {
  resource: string;
  // It is listed after this resource, supports the same actions unless `actions` says
  // otherwise, and a role saved before it existed holds here what it holds there.
  from: PermissionResource;
  actions?: readonly PermissionAction[];
}

const extensions = new Map<string, PermissionExtension>();

// For a build that extends the matrix: called at startup, before any request. Called with
// no argument it puts the core's matrix back, which is how a test undoes one.
export function setPermissionExtensions(list: PermissionExtension[] = []): void {
  extensions.clear();
  PERMISSION_RESOURCES.splice(0, PERMISSION_RESOURCES.length, ...CORE_RESOURCES);
  // In reverse, since each goes right after `from`: the list keeps its order.
  for (const extension of [...list].reverse()) {
    extensions.set(extension.resource, extension);
    PERMISSION_RESOURCES.splice(
      PERMISSION_RESOURCES.indexOf(extension.from) + 1,
      0,
      extension.resource as PermissionResource,
    );
  }
}

export function extendedFrom(resource: PermissionResource): PermissionResource | undefined {
  return extensions.get(resource)?.from;
}

export function resourceActions(resource: PermissionResource): readonly PermissionAction[] {
  const extension = extensions.get(resource);
  return extension?.actions ?? RESOURCE_ACTIONS[extension?.from ?? resource] ?? PERMISSION_ACTIONS;
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

// The matrix of the default system role ("Member") as migrations 0160, 0162 and 0174 leave
// it.
// A member with no role resolves to it.
export function defaultMemberPermissions(): Permissions {
  const p = emptyPermissions();
  for (const r of ['work_items', 'initiatives', 'cycles', 'documents', 'note_boards'] as const) {
    p[r] = allowAll(r);
  }
  p.dashboards.read = true;
  p.views.read = true;
  p.ai_agents.read = true;
  p.agent_schedules.read = true;
  p.members_manage.read = true;
  p.members_invite.read = true;
  for (const { resource, from } of extensions.values()) {
    for (const action of resourceActions(resource as PermissionResource)) {
      p[resource as PermissionResource][action] = p[from][action];
    }
  }
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
    const from = extendedFrom(resource);
    const entry = src[resource] ?? (from && src[from]);
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
