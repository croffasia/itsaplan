// The actions an internal agent can be given, surfaced to the config UI with
// human-readable labels. Two groups:
//
// - AGENT_ACTIONS: mutating actions the user opts an agent into. The enabled subset
//   is stored in ai_agent.tools and becomes the tools the runtime exposes.
// - ALWAYS_ON_ACTIONS: read-only actions always granted, so an agent can always see
//   its project regardless of which actions it is allowed to take. Listed only so
//   the UI can show them (always enabled, not editable); their keys are never
//   stored on the agent.
//
// Every key is the name of a route tagged with mcpTool() — the one exception is
// get_current_date, which has no route behind it (see tools/local.ts). This file is
// only the allowlist and the UI copy: what a tool accepts, what it does, and who may
// call it all come from the route itself (see tools/route-tools.ts). An agent's
// effective rights are the intersection of these keys and its project role.

export interface ToolMeta {
  key: string;
  label: string;
  description: string;
  // True for the read-only actions that are always granted and cannot be toggled off.
  always: boolean;
}

export const AGENT_ACTIONS: ToolMeta[] = [
  {
    key: 'create_issue',
    label: 'Create issues',
    description: 'Create new work items in the project.',
    always: false,
  },
  {
    key: 'update_issue',
    label: 'Update issues',
    description:
      "Change an issue's state, type, initiative, assignee, delegate, details, priority, dates, or labels.",
    always: false,
  },
  {
    key: 'delete_issue',
    label: 'Delete issues',
    description: 'Permanently delete issues and everything attached to them.',
    always: false,
  },
  {
    key: 'add_comment',
    label: 'Comment on issues',
    description: 'Post comments on issues as this agent.',
    always: false,
  },
  {
    key: 'set_issue_field_value',
    label: 'Set custom field values',
    description: 'Set custom field values on an issue.',
    always: false,
  },
  {
    key: 'add_attachment',
    label: 'Add attachments',
    description: 'Attach a file to an issue from a URL or inline content.',
    always: false,
  },
  {
    key: 'delete_attachment',
    label: 'Delete attachments',
    description: 'Delete file attachments from issues.',
    always: false,
  },
  {
    key: 'create_initiative',
    label: 'Create initiatives',
    description: 'Create initiatives in the project.',
    always: false,
  },
  {
    key: 'update_initiative',
    label: 'Update initiatives',
    description: 'Change initiative details, status, owner, dates, and labels.',
    always: false,
  },
  {
    key: 'delete_initiative',
    label: 'Delete initiatives',
    description: 'Permanently delete initiatives.',
    always: false,
  },
];

// Read-only actions, always granted to an internal agent so it can see its project
// regardless of which actions it is allowed to take. Listed for the UI only; these
// keys are never stored on the agent (see normalizeToolKeys).
export const ALWAYS_ON_ACTIONS: ToolMeta[] = [
  {
    key: 'get_current_date',
    label: 'Read the current date',
    description: 'Get the current date and time to resolve relative dates like today or next week.',
    always: true,
  },
  {
    key: 'get_project',
    label: 'Read project setup',
    description: 'View workflow states, issue types, labels, custom fields, and assignees.',
    always: true,
  },
  {
    key: 'search_issues',
    label: 'Search issues',
    description: 'Find issues by a text query (title, description, number, custom fields).',
    always: true,
  },
  {
    key: 'list_issues',
    label: 'List issues by filters',
    description: 'List issues filtered by state, type, assignee, priority, label, or due date.',
    always: true,
  },
  {
    key: 'get_issue',
    label: 'Read an issue',
    description: 'View one issue in full, including its custom field values.',
    always: true,
  },
  {
    key: 'list_attachments',
    label: 'List attachments',
    description: 'View the file attachment metadata on an issue.',
    always: true,
  },
  {
    key: 'list_initiatives',
    label: 'List initiatives',
    description: 'View initiatives in the project.',
    always: true,
  },
  {
    key: 'get_initiative',
    label: 'Read an initiative',
    description: 'View one initiative with its progress and health.',
    always: true,
  },
];

const ACTION_KEYS = new Set(AGENT_ACTIONS.map((t) => t.key));

export const ALWAYS_ON_KEYS: string[] = ALWAYS_ON_ACTIONS.map((t) => t.key);

// Keeps only keys that are grantable actions, so an agent never stores an unknown
// or non-grantable (always-on) tool key.
export function normalizeToolKeys(keys: unknown): string[] {
  if (!Array.isArray(keys)) return [];
  return [...new Set(keys.filter((k): k is string => typeof k === 'string' && ACTION_KEYS.has(k)))];
}
