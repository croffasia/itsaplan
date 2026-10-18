import { createTool } from '@mastra/core/tools';
import { getTool, type CustomToolEntry, type ToolConfig } from '@repo/agent-tools';
import { createPendingAction, recordAgentAction } from '#modules/agent-actions/service';
import { listAgentToolsForRun } from '../../../tools/service';
import { errorMessage } from '../../helpers/errors';
import type { ActionContext } from './route-tools';

type RunTool = { id: number; toolKey: string; credential: ToolConfig };

async function callTool(tool: CustomToolEntry, credential: ToolConfig, input: unknown) {
  try {
    return await tool.execute(credential, input as Record<string, unknown>);
  } catch (err) {
    // Surface the failure to the model as a result rather than aborting the run.
    return { error: errorMessage(err, 'Tool call failed') };
  }
}

function errorOf(result: unknown): string | null {
  return typeof result === 'object' && result !== null && 'error' in result
    ? String((result as { error: unknown }).error)
    : null;
}

// The name a held or logged call is stored under: the catalog key and the configured tool's id,
// so approval runs it with the credential the agent had.
const pendingName = (it: RunTool) => `custom:${it.toolKey}:${it.id}`;

// Builds Mastra tools for the configured tools enabled on an agent. Each tool binds
// its catalog entry's execute to the decrypted credential it was configured with, so
// the model only supplies the call-time input. A tool whose key is no longer in the
// catalog is skipped. When the same tool is enabled more than once (bound to different
// credentials), the ids are suffixed so they do not collide. With `context`, a call of a
// tool marked `writes` is logged; with `context.hold`, every call, reads included, is
// stored for a project member to decide instead.
export function buildCustomTools(
  items: RunTool[],
  context?: ActionContext & { projectId: number },
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
        if (!context?.hold) {
          const result = await callTool(tool, it.credential, input);
          if (context && tool.writes) {
            await recordAgentAction({
              agentId: context.agentId,
              projectId: context.projectId,
              issueId: context.issueId,
              runId: context.runId,
              tool: pendingName(it),
              args: { ...(input as Record<string, unknown>) },
              error: errorOf(result),
            });
          }
          return result;
        }
        const actionId = await createPendingAction({
          agentId: context.agentId,
          projectId: context.projectId,
          issueId: context.issueId,
          runId: context.runId,
          tool: pendingName(it),
          args: { ...(input as Record<string, unknown>) },
        });
        return {
          pendingApproval: true,
          actionId,
          message: 'This call waits for a project member to approve it. It is not sent yet.',
        };
      },
    });
  }
  return tools;
}

// Runs an approved custom call with the credential the agent holds now. Null when the
// name is not a custom call; a tool removed from the agent since is a failure.
export async function runPendingCustomTool(
  agentId: number,
  name: string,
  args: Record<string, unknown>,
): Promise<{ text: string; isError: boolean } | null> {
  if (!name.startsWith('custom:')) return null;
  const it = (await listAgentToolsForRun(agentId)).find((row) => pendingName(row) === name);
  const found = it && getTool(it.toolKey);
  if (!it || !found) return { text: 'The tool is no longer enabled on the agent', isError: true };
  const result = await callTool(found.tool, it.credential, args);
  return { text: JSON.stringify(result), isError: errorOf(result) != null };
}
