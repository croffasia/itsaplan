import { z } from 'zod';
import type { McpInputSchema, McpToolAnnotations } from './generate';
import { outputSchema, type McpOutputSchema } from './result';
import type { Permission } from '#shared/guards';

export interface ToolDescriptor {
  name: string;
  description: string;
  inputSchema: McpInputSchema;
  annotations: McpToolAnnotations;
  outputSchema?: McpOutputSchema;
  permission?: Permission;
  // Set by mcpImageTool.
  images?: boolean;
}

// The default catalog. A client loads every listed tool into the model's context, so
// it holds only the reads most sessions start with; discover_tools finds the others.
const coreNames = new Set([
  'search_workspace',
  'list_projects',
  'get_project',
  'get_issue',
  'get_issue_by_number',
  'list_issues',
  'get_document',
  'list_teams',
]);

const readOnly = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

const invocationSchema: McpInputSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Exact tool name returned by discover_tools.' },
    arguments: { type: 'object', additionalProperties: true },
  },
  required: ['name', 'arguments'],
};

export const discoveryTools: ToolDescriptor[] = [
  {
    name: 'discover_tools',
    description:
      'Find Itsaplan tools by action or resource, such as tasks, boards, documents, comments, or agents. Returns matching input schemas and permission hints. Use an exact tool name to inspect it, then invoke it through call_read_tool or call_tool.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', minLength: 1, maxLength: 200 },
        limit: { type: 'integer', minimum: 1, maximum: 10, default: 5 },
        offset: { type: 'integer', minimum: 0, maximum: 10000, default: 0 },
      },
      required: ['query'],
    },
    annotations: readOnly,
    outputSchema: outputSchema(undefined),
  },
  {
    name: 'call_read_tool',
    description:
      'Run a read-only tool found by discover_tools using its exact name and arguments. Refuses every tool that can change data. The original tool permissions and validation apply.',
    inputSchema: invocationSchema,
    annotations: { ...readOnly, openWorldHint: true },
    outputSchema: outputSchema(undefined),
  },
  {
    name: 'call_tool',
    description:
      'Run a tool found by discover_tools using its exact name and arguments. This can create, change, delete, or send data according to the selected tool. Check its description and annotations first. The original tool permissions and validation apply.',
    inputSchema: invocationSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true,
    },
    outputSchema: outputSchema(undefined),
  },
];

export const invocationArguments = z
  .object({ name: z.string().trim().min(1).max(200), arguments: z.record(z.string(), z.unknown()) })
  .strict();

const searchArguments = z
  .object({
    query: z.string().trim().min(1).max(200),
    limit: z.number().int().min(1).max(10).default(5),
    offset: z.number().int().min(0).max(10000).default(0),
  })
  .strict();

const aliases: Record<string, string[]> = {
  task: ['issue'],
  tasks: ['issue'],
  board: ['project', 'note board'],
  boards: ['project', 'note board'],
  docs: ['document'],
  status: ['column', 'state'],
  states: ['column', 'state'],
  find: ['search', 'list', 'get'],
  read: ['get', 'list'],
  edit: ['update'],
  remove: ['delete', 'remove'],
};
const stopWords = new Set(['a', 'an', 'the', 'for', 'of', 'to', 'in', 'on', 'with', 'my', 'and']);

function invokeWith(tool: ToolDescriptor): string {
  if (tool.images) return tool.name;
  return tool.annotations.readOnlyHint === true ? 'call_read_tool' : 'call_tool';
}

export function discoverTools(tools: ToolDescriptor[], args: Record<string, unknown>) {
  const parsed = searchArguments.safeParse(args);
  if (!parsed.success) return { error: parsed.error.message };
  const { query, offset, limit } = parsed.data;
  const normalized = query.toLowerCase();
  const terms = normalized.split(/[\s_-]+/).filter((term) => term && !stopWords.has(term));
  const exact = tools.find((tool) => tool.name === normalized);
  const matches = (exact ? [exact] : tools)
    .map((tool) => {
      const nameWords = tool.name.split('_');
      const description = tool.description.toLowerCase();
      let score = exact ? 1 : 0;
      for (const term of terms) {
        const alternatives = [term, ...(Object.hasOwn(aliases, term) ? aliases[term] : [])];
        score += Math.max(
          ...alternatives.map((word) => {
            const matchesName = word
              .split(' ')
              .every((part) =>
                nameWords.some(
                  (name) => name === part || name === `${part}s` || `${name}s` === part,
                ),
              );
            // "find" also names get_ tools, ranked below the list_ and search_ tools.
            if (matchesName) return term === 'find' && word === 'get' ? 8 : 10;
            return description.includes(word) ? 1 : 0;
          }),
        );
      }
      return { tool, score };
    })
    .filter(({ score }) => score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.tool.name.split('_').length - b.tool.name.split('_').length ||
        a.tool.name.localeCompare(b.tool.name),
    );
  const end = offset + limit;
  return {
    tools: matches
      .slice(offset, end)
      .map(({ tool }) => ({ ...tool, invokeWith: invokeWith(tool) })),
    total: matches.length,
    nextOffset: end < matches.length ? end : null,
  };
}

export function listCatalog(tools: ToolDescriptor[], mode: 'compact' | 'full') {
  return {
    tools: [
      // Images reach the model only from a direct call, so an image tool is always listed.
      ...tools.filter((tool) => mode === 'full' || coreNames.has(tool.name) || tool.images),
      ...discoveryTools,
    ],
  };
}
