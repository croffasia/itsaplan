import { createTool } from '@mastra/core/tools';
import {
  callMcpTool,
  getTool,
  listMcpTools,
  MCP_TOOL_PREFIX,
  type McpTool,
  type ToolConfig,
} from '@repo/agent-tools';
import { errorMessage } from '../../helpers/errors';
import { freshMcpCredential } from '../../../integrations/mcp';

type Item = { id: number; toolKey: string; credentialId: number; credential: ToolConfig };

type Resolved = {
  key: string;
  description: string;
  inputSchema: Parameters<typeof createTool>[0]['inputSchema'];
  execute: (input: Record<string, unknown>) => Promise<unknown>;
};

// A server that cannot be reached contributes no tools, so the run goes on without them.
async function mcpToolsByCredential(items: Item[]): Promise<Map<number, McpTool[]>> {
  const servers = new Map<number, ToolConfig>();
  for (const it of items) {
    if (it.toolKey.startsWith(MCP_TOOL_PREFIX)) servers.set(it.credentialId, it.credential);
  }
  const listed = await Promise.all(
    [...servers].map(async ([credentialId, credential]) => {
      try {
        return [
          credentialId,
          await listMcpTools(await freshMcpCredential(credentialId, credential)),
        ] as const;
      } catch (err) {
        console.error(`[agent-tools] MCP server of credential ${credentialId} unavailable:`, err);
        return [credentialId, [] as McpTool[]] as const;
      }
    }),
  );
  return new Map(listed);
}

function resolve(it: Item, mcpTools: Map<number, McpTool[]>): Resolved | null {
  if (it.toolKey.startsWith(MCP_TOOL_PREFIX)) {
    const name = it.toolKey.slice(MCP_TOOL_PREFIX.length);
    const remote = mcpTools.get(it.credentialId)?.find((t) => t.name === name);
    if (!remote) return null;
    return {
      // Providers accept [a-zA-Z0-9_-]{1,64}; the slice leaves room for the id suffix.
      key: `mcp_${name}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 54),
      description: remote.description ?? remote.title ?? name,
      inputSchema: remote.inputSchema as Resolved['inputSchema'],
      execute: async (input) =>
        callMcpTool(await freshMcpCredential(it.credentialId, it.credential), name, input),
    };
  }
  const found = getTool(it.toolKey);
  if (!found) return null;
  const { tool } = found;
  return {
    key: tool.key,
    description: tool.description,
    inputSchema: tool.inputSchema,
    execute: (input) => tool.execute(it.credential, input),
  };
}

// Builds Mastra tools for the configured tools enabled on an agent. Each tool binds
// its catalog entry's execute to the decrypted credential it was configured with, so
// the model only supplies the call-time input. A tool whose key is no longer in the
// catalog is skipped. When the same tool is enabled more than once (bound to different
// credentials), the ids are suffixed so they do not collide.
export async function buildCustomTools(
  items: Item[],
): Promise<Record<string, ReturnType<typeof createTool>>> {
  const mcpTools = await mcpToolsByCredential(items);
  const resolved = items.flatMap((it) => {
    const r = resolve(it, mcpTools);
    return r ? [{ id: it.id, ...r }] : [];
  });
  const counts = new Map<string, number>();
  for (const r of resolved) counts.set(r.key, (counts.get(r.key) ?? 0) + 1);

  const tools: Record<string, ReturnType<typeof createTool>> = {};
  for (const r of resolved) {
    const id = (counts.get(r.key) ?? 0) > 1 ? `${r.key}_${r.id}` : r.key;
    tools[id] = createTool({
      id,
      description: r.description,
      inputSchema: r.inputSchema,
      execute: async (input) => {
        try {
          return await r.execute(input as Record<string, unknown>);
        } catch (err) {
          // Surface the failure to the model as a result rather than aborting the run.
          return { error: errorMessage(err, 'Tool call failed') };
        }
      },
    });
  }
  return tools;
}
