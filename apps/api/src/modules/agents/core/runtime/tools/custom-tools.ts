import { createTool } from '@mastra/core/tools';
import type { RunnableTool } from '../../../tools/service';
import { errorMessage } from '../../helpers/errors';

// Builds Mastra tools for the configured tools enabled on an agent. Each one already has
// its credential bound, so the model only supplies the call-time input. A name one of the
// agent's other tools has is left out, so a tool a team defines cannot stand in for one
// of the core's.
export function buildCustomTools(
  items: RunnableTool[],
  taken: Set<string>,
): Record<string, ReturnType<typeof createTool>> {
  const tools: Record<string, ReturnType<typeof createTool>> = {};
  for (const item of items) {
    if (taken.has(item.name)) continue;
    tools[item.name] = createTool({
      id: item.name,
      description: item.description,
      inputSchema: item.inputSchema,
      execute: async (input) => {
        try {
          return await item.run(input as Record<string, unknown>);
        } catch (err) {
          // Surface the failure to the model as a result rather than aborting the run.
          return { error: errorMessage(err, 'Tool call failed') };
        }
      },
    });
  }
  return tools;
}
