import type { PermissionAction, PermissionResource } from '@/lib/api';

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

export interface PermissionGroup {
  // The key of the group's title in messages (permissions.groups).
  key: string;
  resources: PermissionResource[];
}

// The resources shown together in the role editor. Ordering is display order.
const GROUP_DEFS: PermissionGroup[] = [
  { key: 'workItems', resources: ['work_items', 'initiatives', 'cycles', 'views'] },
  { key: 'dashboards', resources: ['dashboards'] },
  { key: 'notes', resources: ['note_boards'] },
  { key: 'ai', resources: ['ai_agents', 'integrations', 'agent_skills', 'agent_tools'] },
  {
    key: 'configuration',
    resources: [
      'states',
      'issue_types',
      'labels',
      'custom_fields',
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
