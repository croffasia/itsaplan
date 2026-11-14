import type { z } from 'zod';
import type { ToolConfig } from '@repo/agent-tools';

// Configured tools an extension of the api defines beside the catalog's: a team's own
// tools, each a configured tool whose key starts with the source's key and a colon. The
// core lists, enables and deletes them as it does the catalog's, and gives them to the
// agents they are enabled on: an internal agent in its runs and chat answers, an
// external one over MCP. A self-hosted instance has no source.

export interface SourceTool {
  // The name the model calls it by. One a core tool of the agent has is left out.
  name: string;
  label: string;
  description: string;
  // False while the instance cannot run it: it stays listed and enabled, and no agent
  // gets it.
  supported: boolean;
  inputSchema: z.ZodType;
  execute: (input: Record<string, unknown>, call: ToolCall) => Promise<unknown>;
}

export interface ToolCall {
  agentId: number;
  teamId: number;
  // The decrypted credential the configured tool is bound to; empty when it has none.
  credential: ToolConfig;
  // Set in a queued run only; absent in a chat answer and over MCP.
  runId?: number;
  // Set over MCP only.
  request?: Request;
}

export interface ToolSource {
  key: string;
  // Its tools among these configured tools of a team, by configured tool id. One it no
  // longer has is left out.
  tools: (
    teamId: number,
    rows: { id: number; toolKey: string }[],
  ) => Promise<Map<number, SourceTool>>;
  // The keys of the team's tools whose label or description holds the text.
  search: (teamId: number, text: string) => Promise<string[]>;
}

let source: ToolSource | null = null;

export function setToolSource(next: ToolSource | null = null): void {
  source = next;
}

export function toolSource(): ToolSource | null {
  return source;
}

// The source a configured tool's key belongs to: the part before the first colon.
export function sourceKeyOf(toolKey: string): string | null {
  const colon = toolKey.indexOf(':');
  return colon > 0 ? toolKey.slice(0, colon) : null;
}
