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
    .describe('Words to look for, such as "delete label", or the exact name of a tool.'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(DISCOVER_MAX_LIMIT)
    .optional()
    .describe(`How many tools to return. Default ${DISCOVER_DEFAULT_LIMIT}.`),
});

// Strict, so a call that puts the tool's arguments beside `name` is refused instead of
// running the tool without them.
const executeInput = z.strictObject({
  name: z.string().describe('The name of the tool to run, as discover returns it.'),
  arguments: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("The tool's own arguments, as its inputSchema describes them."),
});

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
    description: `Run a tool that ${what}. discover names the execute tool of each tool.`,
    inputSchema: mcpInputSchema({ inputSchema: executeInput }),
    annotations,
  });
  return [
    {
      name: 'discover',
      description:
        'Find the tools that are not listed here. Returns the best matches with their ' +
        'description, input schema and the execute tool that runs them. Pass the exact ' +
        'name of a tool to get that tool alone.',
      inputSchema: mcpInputSchema({ inputSchema: discoverInput }),
      annotations: READ,
    },
    execute('read', 'only reads', READ),
    execute('write', 'creates or changes something', WRITE),
    execute('destructive', 'deletes or revokes something', { ...WRITE, destructiveHint: true }),
  ];
}

// The tools matching a query, best first. An exact name answers with that tool alone,
// which is how a client reads one schema again. Otherwise each word of the query scores
// a tool: most as a whole word of its name, less as part of the name, least in the
// description.
export function matchTools(table: McpRouteTool[], query: string): McpRouteTool[] {
  const wanted = query.trim().toLowerCase();
  const exact = table.find((tool) => tool.name === wanted);
  if (exact) return [exact];
  const words = wanted.split(/[^a-z0-9]+/).filter(Boolean);
  return table
    .map((tool) => {
      const nameWords = tool.name.split('_');
      const description = tool.description.toLowerCase();
      let score = 0;
      for (const word of words) {
        if (nameWords.includes(word)) score += 3;
        else if (tool.name.includes(word)) score += 2;
        else if (description.includes(word)) score += 1;
      }
      return { tool, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.tool.name.localeCompare(b.tool.name))
    .map(({ tool }) => tool);
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
    const matches = matchTools(routes.table, parsed.data.query);
    const data = {
      total: matches.length,
      tools: matches.slice(0, parsed.data.limit ?? DISCOVER_DEFAULT_LIMIT).map((tool) => ({
        name: tool.name,
        description: tool.description,
        execute: executeToolFor(tool),
        annotations: tool.annotations,
        inputSchema: routes.inputSchemaOf(tool),
      })),
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
