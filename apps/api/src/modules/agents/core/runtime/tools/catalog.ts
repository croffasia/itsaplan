// The actions an internal agent can be given, surfaced to the config UI with
// human-readable labels. Two groups:
//
// - AGENT_ACTIONS: actions the user opts an agent into. The enabled subset is stored
//   in ai_agent.tools and becomes the tools the runtime exposes. Mutating actions
//   belong here; so do the note board reads, since notes are an optional feature.
// - ALWAYS_ON_ACTIONS: read-only actions always granted, so an agent can always see
//   its project regardless of which actions it is allowed to take. Listed only so
//   the UI can show them (always enabled, not editable); their keys are never
//   stored on the agent.
//
// Every key is the name of a route tagged with mcpTool() — the one exception is
// get_current_date, which has no route behind it (see tools/local.ts). What a tool
// accepts and who may call it come from the route itself (see tools/route-tools.ts);
// this file adds the allowlist, the UI copy, and the agent-only overrides (see
// ToolMeta.overrides). An agent's effective rights are the intersection of these keys
// and its project role.

// The feature an action belongs to, so the config UI can group the catalog.
export type ToolGroup = 'issues' | 'initiatives' | 'cycles' | 'notes' | 'project';

export interface ToolMeta {
  key: string;
  group: ToolGroup;
  label: string;
  // Shown in the config UI next to the label.
  description: string;
  // True for the read-only actions that are always granted and cannot be toggled off.
  always: boolean;
  // What the agent's copy of the tool changes about the route: `description` is the
  // text the model reads instead of the route's own, `hide` are arguments it may not
  // set (dropped from the tool's schema and from its calls). An MCP client is
  // unaffected and still gets the route's full schema and wording.
  overrides?: { description?: string; hide?: string[] };
}

// Told to the model on both note board writes: it lays a canvas out without seeing
// it, so unsized cards clip their text and unspaced ones land on top of each other.
const CARD_LAYOUT =
  'Give each card a `width` and `height` its text fits in — 260×220 holds a short note, longer text needs more — and space `position` so cards do not overlap.';

export const AGENT_ACTIONS: ToolMeta[] = [
  {
    key: 'create_issue',
    group: 'issues',
    label: 'Create issues',
    description: 'Create new work items in the project.',
    always: false,
  },
  {
    key: 'update_issue',
    group: 'issues',
    label: 'Update issues',
    description:
      "Change an issue's state, type, initiative, cycle, assignee, delegate, details, priority, dates, or labels.",
    always: false,
  },
  {
    key: 'delete_issue',
    group: 'issues',
    label: 'Delete issues',
    description: 'Permanently delete issues and everything attached to them.',
    always: false,
  },
  {
    key: 'add_comment',
    group: 'issues',
    label: 'Comment on issues',
    description: 'Post comments on issues as this agent.',
    always: false,
  },
  {
    key: 'set_issue_field_value',
    group: 'issues',
    label: 'Set custom field values',
    description: 'Set custom field values on an issue.',
    always: false,
  },
  {
    key: 'link_issues',
    group: 'issues',
    label: 'Link issues',
    description: 'Mark an issue as blocking, blocked by, duplicating, or related to another one.',
    always: false,
  },
  {
    key: 'unlink_issues',
    group: 'issues',
    label: 'Unlink issues',
    description: 'Remove a relation between two issues.',
    always: false,
  },
  {
    key: 'create_worklog',
    group: 'issues',
    label: 'Log time',
    description: 'Log the time spent on an issue, for example what a run of this agent took.',
    always: false,
  },
  {
    key: 'add_attachment',
    group: 'issues',
    label: 'Add attachments',
    description: 'Attach a file to an issue from a URL or inline content.',
    always: false,
  },
  {
    key: 'delete_attachment',
    group: 'issues',
    label: 'Delete attachments',
    description: 'Delete file attachments from issues.',
    always: false,
  },
  {
    key: 'create_initiative',
    group: 'initiatives',
    label: 'Create initiatives',
    description: 'Create initiatives in the project.',
    always: false,
  },
  {
    key: 'update_initiative',
    group: 'initiatives',
    label: 'Update initiatives',
    description: 'Change initiative details, status, owner, dates, and labels.',
    always: false,
  },
  {
    key: 'delete_initiative',
    group: 'initiatives',
    label: 'Delete initiatives',
    description: 'Permanently delete initiatives.',
    always: false,
  },
  {
    key: 'create_cycle',
    group: 'cycles',
    label: 'Create cycles',
    description: 'Create cycles in the project.',
    always: false,
  },
  {
    key: 'update_cycle',
    group: 'cycles',
    label: 'Update cycles',
    description: 'Change a cycle’s name, description, and dates.',
    always: false,
  },
  {
    key: 'delete_cycle',
    group: 'cycles',
    label: 'Delete cycles',
    description: 'Permanently delete cycles. Their issues stay, without a cycle.',
    always: false,
  },
  {
    key: 'transfer_cycle_issues',
    group: 'cycles',
    label: 'Transfer cycle issues',
    description: "Move a cycle's unfinished issues to another cycle, or off any cycle.",
    always: false,
  },
  {
    key: 'list_note_boards',
    group: 'notes',
    label: 'List note boards',
    description: 'List and search the note boards the agent can see.',
    always: false,
    overrides: {
      description:
        'The note boards in this project. `q` filters by name; `limit` (10 by default, 50 at most) and `offset` page the result. Cards are omitted — read a board with `get_note_board` to get them.',
    },
  },
  {
    key: 'get_note_board',
    group: 'notes',
    label: 'Read a note board',
    description: 'View one board with all of its notes and the connections between them.',
    always: false,
  },
  // `visibility` is hidden on both writes below, `memberIds` on the update: a board
  // that is not public is visible to its owner and whoever they grant access to,
  // and an agent owns itself, so a non-public board it made would be visible to no
  // person in the project.
  {
    key: 'create_note_board',
    group: 'notes',
    label: 'Create note boards',
    description: 'Create a note board with an optional set of notes.',
    always: false,
    overrides: {
      hide: ['visibility'],
      description:
        'Create a note board every project member can see. Cards go in `canvas` as nodes (see `get_note_board`); a card `body` is markdown and `color` a hex string such as `#FFF9B1`. ' +
        CARD_LAYOUT,
    },
  },
  {
    key: 'update_note_board',
    group: 'notes',
    label: 'Update note boards',
    description: 'Rename a board and add, edit, or remove its notes.',
    always: false,
    overrides: {
      hide: ['visibility', 'memberIds'],
      description:
        'Rename a note board or replace its `canvas`. Adding, editing, connecting, or deleting a card is a change to `canvas` (see `get_note_board`). It is replaced as a whole: read the board first, then send every node and edge that must stay — anything left out is deleted. ' +
        CARD_LAYOUT,
    },
  },
  {
    key: 'delete_note_board',
    group: 'notes',
    label: 'Delete note boards',
    description: 'Permanently delete note boards and all of their notes.',
    always: false,
  },
];

// Actions that change nothing, always granted to an internal agent so it can read its
// project and show what it found, regardless of which actions it is allowed to take.
// Listed for the UI only; these keys are never stored on the agent (see normalizeToolKeys).
export const ALWAYS_ON_ACTIONS: ToolMeta[] = [
  {
    key: 'create_chart',
    group: 'project',
    label: 'Draw charts',
    description: 'Build a chart to show in the chat instead of writing the numbers out.',
    always: true,
  },
  {
    key: 'get_current_date',
    group: 'project',
    label: 'Read the current date',
    description: 'Get the current date and time to resolve relative dates like today or next week.',
    always: true,
  },
  {
    key: 'get_project',
    group: 'project',
    label: 'Read project setup',
    description: 'View workflow states, issue types, labels, custom fields, and assignees.',
    always: true,
  },
  {
    key: 'search_issues',
    group: 'issues',
    label: 'Search issues',
    description: 'Find issues by a text query (title, description, number, custom fields).',
    always: true,
  },
  {
    key: 'list_issues',
    group: 'issues',
    label: 'List issues by filters',
    description: 'List issues filtered by state, type, assignee, priority, label, or due date.',
    always: true,
  },
  {
    key: 'get_issue',
    group: 'issues',
    label: 'Read an issue',
    description: 'View one issue in full, including its custom field values.',
    always: true,
  },
  {
    key: 'list_issue_activity',
    group: 'issues',
    label: 'Read an issue discussion',
    description: "Read an issue's comments and change log, replies included.",
    always: true,
  },
  {
    key: 'list_attachments',
    group: 'issues',
    label: 'List attachments',
    description: 'View the file attachment metadata on an issue.',
    always: true,
  },
  {
    key: 'list_initiatives',
    group: 'initiatives',
    label: 'List initiatives',
    description: 'View initiatives in the project.',
    always: true,
  },
  {
    key: 'get_initiative',
    group: 'initiatives',
    label: 'Read an initiative',
    description: 'View one initiative with its progress and health.',
    always: true,
  },
  {
    key: 'list_cycles',
    group: 'cycles',
    label: 'List cycles',
    description: 'View the cycles of the project with their progress.',
    always: true,
  },
  {
    key: 'get_cycle',
    group: 'cycles',
    label: 'Read a cycle',
    description: 'View one cycle with its dates and progress.',
    always: true,
  },
];

const ACTION_KEYS = new Set(AGENT_ACTIONS.map((t) => t.key));

export const ALWAYS_ON_KEYS: string[] = ALWAYS_ON_ACTIONS.map((t) => t.key);

const BY_KEY = new Map([...AGENT_ACTIONS, ...ALWAYS_ON_ACTIONS].map((t) => [t.key, t]));

export function toolMeta(key: string): ToolMeta | undefined {
  return BY_KEY.get(key);
}

// Keeps only keys that are grantable actions, so an agent never stores an unknown
// or non-grantable (always-on) tool key.
export function normalizeToolKeys(keys: unknown): string[] {
  if (!Array.isArray(keys)) return [];
  return [...new Set(keys.filter((k): k is string => typeof k === 'string' && ACTION_KEYS.has(k)))];
}
