import type { PermissionAction, PermissionResource } from '@/lib/api';

// Human labels for the permission matrix. A resource/action not listed falls back
// to its prettified slug.
const RESOURCE_LABELS: Record<string, string> = {
  work_items: 'Work items',
  initiatives: 'Initiatives',
  dashboards: 'Dashboards',
  views: 'Work item views',
  members_invite: 'Invites',
  members_manage: 'Members',
  states: 'States',
  issue_types: 'Issue types',
  labels: 'Labels',
  ai_agents: 'AI agents',
  integrations: 'Integrations',
  agent_skills: 'Agent skills',
  agent_tools: 'Agent tools',
  custom_fields: 'Custom fields',
  actions: 'Actions',
  webhooks: 'Webhooks',
  danger_zone: 'Danger zone',
};

const ACTION_LABELS: Record<string, string> = {
  create: 'Create',
  edit: 'Edit',
  read: 'Read',
  delete: 'Delete',
};

const prettify = (slug: string) => slug.replace(/_/g, ' ');

export const resourceLabel = (resource: PermissionResource) =>
  RESOURCE_LABELS[resource] ?? prettify(resource);
export const actionLabel = (action: PermissionAction) => ACTION_LABELS[action] ?? prettify(action);

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
  title: string;
  resources: PermissionResource[];
}

// The resources shown together in the role editor. Ordering is display order.
const GROUP_DEFS: PermissionGroup[] = [
  { title: 'Work items', resources: ['work_items', 'initiatives', 'views'] },
  { title: 'Dashboards', resources: ['dashboards'] },
  { title: 'AI', resources: ['ai_agents', 'integrations', 'agent_skills', 'agent_tools'] },
  {
    title: 'Configuration',
    resources: ['states', 'issue_types', 'labels', 'custom_fields', 'actions', 'webhooks'],
  },
  { title: 'Members', resources: ['members_manage', 'members_invite'] },
  { title: 'Project', resources: ['danger_zone'] },
];

// Order the catalog's resources into display groups. A resource not covered by
// GROUP_DEFS (e.g. one added on the API) falls into a trailing "Other" group, so
// nothing silently disappears from the editor.
export function groupResources(resources: PermissionResource[]): PermissionGroup[] {
  const present = new Set(resources);
  const known = new Set(GROUP_DEFS.flatMap((g) => g.resources));
  const groups = GROUP_DEFS.map((g) => ({
    title: g.title,
    resources: g.resources.filter((r) => present.has(r)),
  })).filter((g) => g.resources.length > 0);
  const other = resources.filter((r) => !known.has(r));
  if (other.length) groups.push({ title: 'Other', resources: other });
  return groups;
}
