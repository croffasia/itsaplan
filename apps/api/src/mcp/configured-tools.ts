import { z } from 'zod';
import { errorMessage } from '#modules/agents/core/helpers/errors';
import { agentOfUser } from '#modules/agents/core/service';
import { agentToolSet, type RunnableTool } from '#modules/agents/tools/service';
import { teamMcpEnabled } from '#modules/teams/service';
import type { McpInputSchema } from './generate';
import { toolError } from './result';

// The configured tools enabled on the agent a key belongs to, which an external agent
// calls over MCP as an internal one calls them in its runs. A person's key has none, nor an
// agent of a team MCP is off for, and a name a route tool has is left out.
export async function agentMcpTools(
  userId: string,
  taken: Set<string>,
  request?: Request,
): Promise<RunnableTool[]> {
  const agent = await agentOfUser(userId);
  if (!agent || !(await teamMcpEnabled(agent.teamId))) return [];
  return (await agentToolSet(agent, { request })).filter((tool) => !taken.has(tool.name));
}

export function mcpInputSchema(tool: RunnableTool): McpInputSchema {
  const { $schema: _, ...schema } = z.toJSONSchema(tool.inputSchema, {
    io: 'input',
    unrepresentable: 'any',
  }) as Record<string, unknown>;
  return { type: 'object', properties: {}, required: [], ...schema };
}

function failure(status: number, text: string) {
  return {
    content: [{ type: 'text' as const, text }],
    isError: true,
    structuredContent: toolError(status, text),
  };
}

export async function callConfiguredTool(tool: RunnableTool, args: Record<string, unknown>) {
  const parsed = tool.inputSchema.safeParse(args);
  if (!parsed.success) return failure(400, z.prettifyError(parsed.error));
  try {
    const result = await tool.run(parsed.data as Record<string, unknown>);
    return { content: [{ type: 'text' as const, text: JSON.stringify(result ?? null) }] };
  } catch (err) {
    return failure(502, errorMessage(err, 'Tool call failed'));
  }
}
