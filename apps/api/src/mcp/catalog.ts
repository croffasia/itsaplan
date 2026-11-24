import { z } from 'zod';
import type { McpInputSchema, McpRouteTool, McpToolAnnotations } from './generate';
import { mcpInputSchema } from './configured-tools';
import { toolFailure } from './result';

// The route tools catalog mode lists directly, with their own schemas. The criterion is
// that almost every session needs the tool: identifying the caller, resolving a project
// and its ids, and reading, finding, creating, updating and commenting on an issue.
// Each one adds its schema to every session, so a tool some sessions need stays out.
export const PRIMARY_TOOLS = [
  'get_current_user',
  'list_projects',
  'get_project',
  'get_issue_by_number',
  'search_issues',
  'list_issues',
  'create_issue',
  'update_issue',
  'add_comment',
];

// One execute tool per tier, so a client that asks the user to confirm a call by its
// annotations still can: the annotations of an execute tool hold for every tool it runs.
const EXECUTE_TOOLS = {
  read: 'execute_read',
  write: 'execute_write',
  destructive: 'execute_destructive',
} as const;
type Tier = keyof typeof EXECUTE_TOOLS;

// destructiveHint is read first: a tool carrying both hints is confirmed as destructive.
function tierOf(tool: McpRouteTool): Tier {
  if (tool.annotations.destructiveHint) return 'destructive';
  return tool.annotations.readOnlyHint ? 'read' : 'write';
}

export function executeToolFor(tool: McpRouteTool): string {
  return EXECUTE_TOOLS[tierOf(tool)];
}

const DISCOVER_DEFAULT_LIMIT = 5;
// A result carries each tool's input schema, the largest of which is about 8,000
// characters, so the cap bounds one response to a few thousand tokens.
const DISCOVER_MAX_LIMIT = 10;

const discoverInput = z.strictObject({
  query: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .describe('Words to search for, such as "delete label", or a tool\'s exact name.'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(DISCOVER_MAX_LIMIT)
    .optional()
    .describe(`Default ${DISCOVER_DEFAULT_LIMIT}.`),
});

// Strict, so a call that puts the tool's arguments beside `name` is refused instead of
// running the tool without them.
const executeInput = z.strictObject({
  name: z.string().describe('Tool name from discover.'),
  arguments: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("The tool's arguments, as its inputSchema describes them."),
});

// The resources the tools are named after, as the tool names spell them. discover
// states them in its description, so a client knows the vocabulary before its first
// query, and returns them with a count of tools when a query has a word no tool has. A
// resource with no tool left fails the catalog unit test.
export const RESOURCES = [
  'issue',
  'comment',
  'checklist',
  'worklog',
  'attachment',
  'watcher',
  'label',
  'custom field',
  'issue type',
  'template',
  'column',
  'cycle',
  'initiative',
  'document',
  'view',
  'dashboard',
  'chart',
  'action',
  'note board',
  'project',
  'member',
  'role',
  'invite',
  'team',
  'notification',
  'webhook',
  'agent',
  'skill',
  'schedule',
  'integration',
];

const READ: McpToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};
const WRITE: McpToolAnnotations = { ...READ, readOnlyHint: false, idempotentHint: false };

export function catalogTools() {
  const execute = (tier: Tier, what: string, annotations: McpToolAnnotations) => ({
    name: EXECUTE_TOOLS[tier],
    description: `Run a tool that ${what}. discover says which execute tool runs it.`,
    inputSchema: mcpInputSchema({ inputSchema: executeInput }),
    annotations,
  });
  return [
    {
      name: 'discover',
      description:
        'Find the tools that are not listed here by the words of their name and ' +
        'description. Returns the best matches, ranked by relevance, with their ' +
        'description, input schema and the execute tool that runs them. Pass the exact ' +
        'name of a tool to get that tool alone. Tool names and descriptions are in ' +
        'English: put a request made in another language into English words. The tools ' +
        `are named after these resources: ${RESOURCES.join(', ')}.`,
      inputSchema: mcpInputSchema({ inputSchema: discoverInput }),
      annotations: READ,
    },
    execute('read', 'only reads', READ),
    execute('write', 'creates or changes data', WRITE),
    execute('destructive', 'deletes or revokes data', { ...WRITE, destructiveHint: true }),
  ];
}

// A camelCase name is split first, so "replyToId" in a description or a property name is
// indexed as "reply", "to" and "id". A trailing plural is dropped, so "labels" finds
// delete_label and "deliveries" finds "delivery". No other stemming.
function wordsOf(text: string): string[] {
  return text
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((word) => {
      if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
      return word.length > 3 && /[^s]s$/.test(word) ? word.slice(0, -1) : word;
    });
}

// Everyday words, each with the words the tools use for it. A query word found here is
// searched under those words as well as its own. The table is applied to the query and
// not to the index, so the index stays the text of the tools and the words that matched
// nothing can be reported as they were typed.
//
// To extend it: add the word in the singular, with words that appear in tool names or
// descriptions. English only, as the tools are. The catalog unit test refuses an entry
// that leads to a word no tool has, and its query fixture measures what an entry changes.
export const ALIASES: Record<string, string[]> = {
  // Resources
  ticket: ['issue'],
  task: ['issue'],
  subtask: ['issue', 'parent'],
  wiki: ['document'],
  page: ['document'],
  doc: ['document'],
  sprint: ['cycle'],
  iteration: ['cycle'],
  status: ['column', 'state'],
  board: ['column'],
  epic: ['initiative'],
  roadmap: ['initiative'],
  tag: ['label'],
  follower: ['watcher'],
  subscriber: ['watcher'],
  inbox: ['notification'],
  mention: ['notification'],
  bot: ['agent'],
  whiteboard: ['note', 'board'],
  sticky: ['note', 'board'],
  filter: ['view'],
  workspace: ['team'],
  teammate: ['member'],
  user: ['member'],
  people: ['member'],
  todo: ['checklist'],
  hour: ['worklog'],
  timesheet: ['worklog'],
  history: ['activity', 'revision', 'run'],
  version: ['revision'],
  trash: ['archived'],
  screenshot: ['image'],
  dependency: ['link'],
  burndown: ['burnup'],
  velocity: ['throughput'],
  bug: ['issue'],
  report: ['create'],
  story: ['issue'],
  card: ['issue'],
  point: ['estimate'],
  deadline: ['due'],
  urgent: ['priority'],
  done: ['status', 'state'],
  organization: ['team'],
  org: ['team'],
  company: ['team'],
  invitation: ['invite'],
  milestone: ['initiative', 'cycle'],
  goal: ['initiative'],
  okr: ['initiative'],
  objective: ['initiative'],
  widget: ['chart', 'dashboard'],
  metric: ['stat'],
  analytic: ['stat'],
  usage: ['stat'],
  cost: ['stat'],
  alert: ['notification'],
  article: ['document'],
  knowledge: ['document'],
  canvas: ['note', 'board'],
  file: ['attachment'],
  token: ['credential'],
  prompt: ['instruction'],
  assistant: ['agent'],
  admin: ['role', 'owner'],
  permission: ['access', 'role'],
  owner: ['ownership'],
  me: ['current'],
  profile: ['current'],
  recurring: ['schedule', 'cron'],
  repeat: ['schedule'],
  fail: ['run', 'error'],
  deleted: ['archived', 'restore'],
  health: ['pulse', 'activity', 'stat'],
  current: ['active'],
  // Verbs
  edit: ['update'],
  change: ['update'],
  modify: ['update'],
  rename: ['update', 'name'],
  remove: ['delete'],
  show: ['get', 'list'],
  find: ['search', 'list'],
  make: ['create'],
  add: ['create'],
  close: ['finish', 'status'],
  resolve: ['status', 'update'],
  reopen: ['status', 'update'],
  assign: ['assignee'],
  unassign: ['assignee'],
  set: ['update'],
  move: ['update'],
  new: ['create'],
  decline: ['reject'],
  refuse: ['reject'],
  extend: ['renew'],
  react: ['reaction'],
  like: ['reaction'],
  reply: ['comment'],
  trigger: ['run'],
  launch: ['run'],
  stop: ['cancel'],
  abort: ['cancel'],
  hide: ['hidden'],
  unhide: ['hidden'],
  carry: ['transfer'],
  tick: ['update'],
  give: ['set', 'add'],
  grant: ['set', 'add'],
  complete: ['finish'],
  clone: ['copy', 'duplicate'],
  copy: ['duplicate'],
  bookmark: ['favorite'],
  star: ['favorite'],
  upload: ['add'],
  attach: ['add', 'attachment'],
  download: ['view'],
  subscribe: ['watcher'],
  follow: ['watcher'],
  block: ['link'],
  unarchive: ['restore'],
  kick: ['remove'],
  cancel: ['delete', 'revoke'],
  resend: ['send'],
  reset: ['regenerate', 'rotate'],
  share: ['publish'],
  log: ['worklog', 'run', 'delivery', 'activity'],
};
const aliasesOf = new Map(
  Object.entries(ALIASES).map(([word, used]) => [wordsOf(word)[0], used.flatMap(wordsOf)]),
);

// The parameters that say which project or team a tool acts in are left out: projectKey
// on half the tools would make "project" a word that ranks nothing. The other path
// parameters stay, as an id is often the only property a reader has: without "cycle" from
// cycleId, "sprint details" would rank get_cycle below the tools that change a cycle.
const SCOPE_PARAMS = ['projectKey', 'teamId'];
function propertyWordsOf(tool: McpRouteTool): string[] {
  return Object.keys(tool.inputSchema.properties)
    .filter((name) => !SCOPE_PARAMS.includes(name))
    .flatMap(wordsOf);
}

// The usual BM25 constants: K1 caps what a repeated word adds, B is how far a long
// text is discounted.
const K1 = 1.2;
const B = 0.75;
// The name, the description and the input property names are scored apart and added. A
// word of the name counts double: the name says what the tool does, the description
// also names other tools. A property name counts least: it finds the tool that sets a
// field ("due date") without outranking a tool named after the word.
const NAME_WEIGHT = 2;
const PROPERTY_WEIGHT = 0.5;
// A word reached through an alias counts less than a word of the query, so a tool that
// has the caller's own word ("copy") stays above one that has only its alias.
const ALIAS_WEIGHT = 0.75;

function averageLength(texts: string[][]): number {
  return texts.reduce((sum, words) => sum + words.length, 0) / texts.length || 1;
}

interface ToolMatches {
  tools: McpRouteTool[];
  // The words of the query that no tool has, under their own name or an alias.
  unmatched: string[];
}

// Indexes the table and returns the search over it: the tools matching a query, best
// first, ranked with BM25. A word found in few tools ("revoke") weighs more than one
// found in many ("list"). An exact name answers with that tool alone, which is how a
// client reads one schema again. A tool that has no word of the query, nor an alias of
// one, is left out.
export function toolSearch(table: McpRouteTool[]): (query: string) => ToolMatches {
  const docs = table.map((tool) => ({
    tool,
    name: wordsOf(tool.name),
    description: wordsOf(tool.description),
    properties: propertyWordsOf(tool),
  }));
  const averageName = averageLength(docs.map((doc) => doc.name));
  const averageDescription = averageLength(docs.map((doc) => doc.description));
  const averageProperties = averageLength(docs.map((doc) => doc.properties));
  const toolsWith = new Map<string, number>();
  for (const doc of docs) {
    for (const word of new Set([...doc.name, ...doc.description, ...doc.properties])) {
      toolsWith.set(word, (toolsWith.get(word) ?? 0) + 1);
    }
  }

  const fieldScore = (words: string[], average: number, word: string) => {
    const count = words.filter((w) => w === word).length;
    return (count * (K1 + 1)) / (count + K1 * (1 - B + (B * words.length) / average));
  };

  return (query) => {
    const exact = table.find((tool) => tool.name === query.trim().toLowerCase());
    if (exact) return { tools: [exact], unmatched: [] };

    // A term is what the caller typed between spaces and punctuation, in any script, so
    // a term the index cannot hold ("티켓") is reported back like any other.
    const terms = [
      ...new Set(
        query
          .toLowerCase()
          .split(/[^\p{L}\p{N}]+/u)
          .filter(Boolean),
      ),
    ];
    const weights = new Map<string, number>();
    const unmatched: string[] = [];
    for (const term of terms) {
      const searched = wordsOf(term)
        .flatMap((word) => [
          { word, weight: 1 },
          ...(aliasesOf.get(word) ?? []).map((alias) => ({ word: alias, weight: ALIAS_WEIGHT })),
        ])
        .filter(({ word }) => toolsWith.has(word));
      if (searched.length === 0) unmatched.push(term);
      for (const { word, weight } of searched) {
        weights.set(word, Math.max(weights.get(word) ?? 0, weight));
      }
    }

    const tools = docs
      .map((doc) => {
        let score = 0;
        for (const [word, weight] of weights) {
          const found = toolsWith.get(word)!;
          const rarity = Math.log(1 + (docs.length - found + 0.5) / (found + 0.5));
          score +=
            weight *
            rarity *
            (NAME_WEIGHT * fieldScore(doc.name, averageName, word) +
              fieldScore(doc.description, averageDescription, word) +
              PROPERTY_WEIGHT * fieldScore(doc.properties, averageProperties, word));
        }
        return { tool: doc.tool, score };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || a.tool.name.localeCompare(b.tool.name))
      .map(({ tool }) => tool);
    return { tools, unmatched };
  };
}

// How many tools are named after each resource: what discover offers in place of
// matches, so the next query can use a word the tools have. The first word of a name is
// its verb, which is why view_attachment does not count as a tool of "view".
function resourceCounts(table: McpRouteTool[]): Record<string, number> {
  const names = table.map((tool) => ` ${wordsOf(tool.name).slice(1).join(' ')} `);
  return Object.fromEntries(
    RESOURCES.map((resource) => [
      resource,
      names.filter((name) => name.includes(` ${resource} `)).length,
    ]),
  );
}

type ToolResult = { content: unknown[]; isError?: boolean; structuredContent?: unknown };

// What the catalog tools need from the server that serves them: the route table, the
// input schema this caller gets for a tool, and the call path of a direct tool call.
interface CatalogRoutes {
  table: McpRouteTool[];
  inputSchemaOf: (tool: McpRouteTool) => McpInputSchema;
  call: (tool: McpRouteTool, args: Record<string, unknown>) => Promise<ToolResult>;
}

export async function callCatalogTool(
  name: string,
  args: Record<string, unknown>,
  routes: CatalogRoutes,
): Promise<ToolResult> {
  if (name === 'discover') {
    const parsed = discoverInput.safeParse(args);
    if (!parsed.success) return toolFailure(400, z.prettifyError(parsed.error));
    const { tools, unmatched } = toolSearch(routes.table)(parsed.data.query);
    const data = {
      total: tools.length,
      tools: tools.slice(0, parsed.data.limit ?? DISCOVER_DEFAULT_LIMIT).map((tool) => ({
        name: tool.name,
        description: tool.description,
        execute: executeToolFor(tool),
        annotations: tool.annotations,
        inputSchema: routes.inputSchemaOf(tool),
      })),
      // A query that missed gets the means to ask again: the words no tool has, and the
      // words the tools are named after.
      ...((tools.length === 0 || unmatched.length > 0) && {
        unmatched,
        resources: resourceCounts(routes.table),
      }),
    };
    return {
      content: [{ type: 'text', text: JSON.stringify(data) }],
      structuredContent: { ok: true, status: 200, data },
    };
  }

  const parsed = executeInput.safeParse(args);
  if (!parsed.success) return toolFailure(400, z.prettifyError(parsed.error));
  const tool = routes.table.find((t) => t.name === parsed.data.name);
  if (!tool) return toolFailure(404, `Unknown tool: ${parsed.data.name}`);
  const right = executeToolFor(tool);
  if (right !== name) return toolFailure(400, `${tool.name} is run with ${right}, not ${name}.`);
  return routes.call(tool, parsed.data.arguments ?? {});
}
