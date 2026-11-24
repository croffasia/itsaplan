import type { AgentConfig } from '@mastra/core/agent';
import type { createTool } from '@mastra/core/tools';
import type { AgentRunTrigger } from '../model';

// How an extension of the api builds on an internal agent before it works, in a queued run
// or a chat answer: it is handed the config the core assembled (the instructions, the tools,
// the memory) with what the agent is about to do, and returns the config the agent is made
// with, which takes whatever Mastra's Agent takes, input and output processors among them.
// A self-hosted instance keeps the core's. An external agent is built by its runner on the
// operator's machine and never comes here.

export interface AgentWork {
  agentId: number;
  teamId: number;
  projectId: number;
  // The queued run the agent does and what triggered it; absent for a chat answer.
  runId?: number;
  trigger?: AgentRunTrigger;
  issueId?: number | null;
  // Tools for the routes tagged mcpTool() under these names, bound to the agent's project
  // and called with its key, as its own route tools are. A name no route has is left out.
  routeTools: (names: string[]) => Record<string, ReturnType<typeof createTool>>;
}

type AgentBuild = (config: AgentConfig, work: AgentWork) => AgentConfig | Promise<AgentConfig>;

const keepConfig: AgentBuild = (config) => config;

let build = keepConfig;

export function setAgentBuild(next = keepConfig): void {
  build = next;
}

export async function buildOnAgent(config: AgentConfig, work: AgentWork): Promise<AgentConfig> {
  return build(config, work);
}
