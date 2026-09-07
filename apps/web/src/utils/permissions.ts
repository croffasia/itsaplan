import type {
  PermissionAction,
  PermissionCatalog,
  PermissionResource,
  Permissions,
} from '@/lib/api';

// Column display order for the permission matrix. An action not listed (one added
// on the API) sorts to the end, keeping its catalog order.
export const ACTION_ORDER: PermissionAction[] = ['read', 'create', 'edit', 'delete'];

export function orderActions(actions: PermissionAction[]): PermissionAction[] {
  const rank = (a: PermissionAction) => {
    const i = ACTION_ORDER.indexOf(a);
    return i === -1 ? ACTION_ORDER.length : i;
  };
  return [...actions].sort((a, b) => rank(a) - rank(b));
}

// Reads the catalog's per-resource action subsets: a cell outside its resource's
// subset carries no permission and is not rendered.
export function catalogSupport(catalog: PermissionCatalog) {
  const byResource = new Map(catalog.resources.map((r) => [r.key, new Set(r.actions)]));
  return (resource: PermissionResource, action: PermissionAction) =>
    byResource.get(resource)?.has(action) === true;
}

// A full matrix over the catalog, reading each flag from `source` and defaulting
// anything missing, non-boolean or unsupported by the resource to false. Mirrors
// normalizePermissions on the API, so what the UI shows is what a save keeps.
export function matrixFromCatalog(catalog: PermissionCatalog, source: unknown): Permissions {
  const src = (source && typeof source === 'object' ? source : {}) as Record<
    string,
    Record<string, unknown> | undefined
  >;
  const out = {} as Permissions;
  for (const resource of catalog.resources) {
    const row = {} as Record<PermissionAction, boolean>;
    for (const action of catalog.actions) {
      row[action] = resource.actions.includes(action) && src[resource.key]?.[action] === true;
    }
    out[resource.key] = row;
  }
  return out;
}

// Every action the catalog's resources support: the matrix an owner resolves to,
// who bypasses the stored one entirely.
function fullMatrix(catalog: PermissionCatalog): Permissions {
  const out = {} as Permissions;
  for (const resource of catalog.resources) {
    const row = {} as Record<PermissionAction, boolean>;
    for (const action of catalog.actions) row[action] = resource.actions.includes(action);
    out[resource.key] = row;
  }
  return out;
}

// What a project membership resolves to, read from the team's roles rather than
// carried on every member: an owner gets everything, anyone else the matrix of the
// role they hold, or of the team's default role when they carry none. Undefined
// while the catalog or the roles are still loading, which renders as a skeleton.
export function membershipPermissions(
  catalog: PermissionCatalog | undefined,
  roles: { id: number; isDefault: boolean; permissions: Permissions }[],
  member: { role: 'owner' | 'member'; roleId: number | null },
): Permissions | undefined {
  if (!catalog) return undefined;
  if (member.role === 'owner') return fullMatrix(catalog);
  if (roles.length === 0) return undefined;
  const role = roles.find((r) => r.id === member.roleId) ?? roles.find((r) => r.isDefault);
  return matrixFromCatalog(catalog, role?.permissions ?? {});
}

export interface PermissionGroup {
  // The key of the group's title in messages (permissions.groups).
  key: string;
  resources: PermissionResource[];
}

// The resources shown together in the role editor. Ordering is display order.
const GROUP_DEFS: PermissionGroup[] = [
  { key: 'workItems', resources: ['work_items', 'initiatives', 'cycles', 'views'] },
  { key: 'dashboards', resources: ['dashboards'] },
  { key: 'documents', resources: ['documents'] },
  { key: 'notes', resources: ['note_boards'] },
  { key: 'ai', resources: ['ai_agents', 'integrations', 'agent_skills', 'agent_tools'] },
  {
    key: 'configuration',
    resources: [
      'states',
      'issue_types',
      'labels',
      'custom_fields',
      'issue_templates',
      'workflow_config',
      'actions',
      'webhooks',
    ],
  },
  { key: 'members', resources: ['members_manage', 'members_invite'] },
  { key: 'project', resources: ['danger_zone'] },
];

// Order the catalog's resources into display groups. A resource not covered by
// GROUP_DEFS (e.g. one added on the API) falls into a trailing "Other" group, so
// nothing silently disappears from the editor.
export function groupResources(resources: PermissionResource[]): PermissionGroup[] {
  const present = new Set(resources);
  const known = new Set(GROUP_DEFS.flatMap((g) => g.resources));
  const groups = GROUP_DEFS.map((g) => ({
    key: g.key,
    resources: g.resources.filter((r) => present.has(r)),
  })).filter((g) => g.resources.length > 0);
  const other = resources.filter((r) => !known.has(r));
  if (other.length) groups.push({ key: 'other', resources: other });
  return groups;
}
