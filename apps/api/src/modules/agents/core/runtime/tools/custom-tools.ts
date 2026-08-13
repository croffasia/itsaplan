import { createTool } from '@mastra/core/tools';
import { getTool, type ToolConfig } from '@repo/agent-tools';
import { errorMessage } from '../../helpers/errors';

// Builds Mastra tools for the configured tools enabled on an agent. Each tool binds
// its catalog entry's execute to the decrypted credential it was configured with, so
// the model only supplies the call-time input. A tool whose key is no longer in the
// catalog is skipped. When the same tool is enabled more than once (bound to different
// credentials), the ids are suffixed so they do not collide.
export function buildCustomTools(
  items: { id: number; toolKey: string; credential: ToolConfig }[],
): Record<string, ReturnType<typeof createTool>> {
  const counts = new Map<string, number>();
  for (const it of items) counts.set(it.toolKey, (counts.get(it.toolKey) ?? 0) + 1);

  const tools: Record<string, ReturnType<typeof createTool>> = {};
  for (const it of items) {
    const found = getTool(it.toolKey);
    if (!found) continue;
    const { tool } = found;
    const id = (counts.get(it.toolKey) ?? 0) > 1 ? `${tool.key}_${it.id}` : tool.key;
    tools[id] = createTool({
      id,
      description: tool.description,
      inputSchema: tool.inputSchema,
      execute: async (input) => {
        try {
          return await tool.execute(it.credential, input as Record<string, unknown>);
        } catch (err) {
          // Surface the failure to the model as a result rather than aborting the run.
          return { error: errorMessage(err, 'Tool call failed') };
        }
      },
    });
  }
  return tools;
}
