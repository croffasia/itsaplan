// Permission model for project roles. A role carries a matrix: for each resource
// the create/edit/read/delete flags. The matrix is stored as jsonb on
// project_role and enforced here and in shared/access.ts. Owners bypass the
// matrix entirely (full access).
//
// Resources map to the areas a project exposes:
//   work_items     issues, their comments, attachments, and the board view
//   initiatives    initiatives (issue groupings) and their activity feed
//   dashboards     saved dashboards and the analytics that back them
//   views          saved work-items views
//   members_invite project invites
//   members_manage the member list (view/remove members)
//   states         workflow columns
//   issue_types    issue types
//   labels         labels and label groups
//   ai_agents      AI agents attached to the project
//   integrations   stored integration credentials (LLM keys and tool creds)
//   agent_skills   the project skill library given to internal agents
//   agent_tools    tools configured on a credential and given to agents
//   custom_fields  custom field definitions
//   actions        saved actions (macros)
//   webhooks       outgoing webhook subscriptions
//   danger_zone    project-level settings and deletion

export const PERMISSION_RESOURCES = [
  'work_items',
  'initiatives',
  'dashboards',
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
  'actions',
  'webhooks',
  'danger_zone',
] as const;
export type PermissionResource = (typeof PERMISSION_RESOURCES)[number];

export const PERMISSION_ACTIONS = ['create', 'edit', 'read', 'delete'] as const;
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

export type ResourcePermissions = Record<PermissionAction, boolean>;
export type Permissions = Record<PermissionResource, ResourcePermissions>;

function fill(value: boolean): ResourcePermissions {
  return { create: value, edit: value, read: value, delete: value };
}

// All flags false — the base a normalizer starts from.
export function emptyPermissions(): Permissions {
  return Object.fromEntries(PERMISSION_RESOURCES.map((r) => [r, fill(false)])) as Permissions;
}

// All flags true — the effective matrix for an owner (owners bypass checks, but
// this is returned so a member context always carries a resolved matrix).
export function fullPermissions(): Permissions {
  return Object.fromEntries(PERMISSION_RESOURCES.map((r) => [r, fill(true)])) as Permissions;
}

// The default "Member" role assigned to members that join a project. Full access
// to work items, read-only on dashboards and views, and no access to member
// management, invites, or project settings. read is left on for the entity
// resources the board and issue editors need to render (states, issue types,
// labels, ai_agents, custom fields). Keep this in sync with the backfill
// migration that seeds existing projects.
export function defaultMemberPermissions(): Permissions {
  const p = emptyPermissions();
  p.work_items = fill(true);
  p.initiatives = fill(true);
  p.dashboards.read = true;
  p.views.read = true;
  p.states.read = true;
  p.issue_types.read = true;
  p.labels.read = true;
  p.ai_agents.read = true;
  p.custom_fields.read = true;
  return p;
}

// Coerces arbitrary input (a jsonb blob or a request body) into the canonical
// matrix: every resource and action present, values coerced to booleans, unknown
// keys dropped, missing entries defaulted to false.
export function normalizePermissions(input: unknown): Permissions {
  const out = emptyPermissions();
  if (!input || typeof input !== 'object') return out;
  const src = input as Record<string, unknown>;
  for (const resource of PERMISSION_RESOURCES) {
    const entry = src[resource];
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    for (const action of PERMISSION_ACTIONS) {
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
