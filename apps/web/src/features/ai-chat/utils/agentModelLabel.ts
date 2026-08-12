import type { AiAgent } from '@/lib/api';

// The agent's model as shown in the chat UI: the model key plus its provider's
// catalog label. `providerLabel` maps a provider key to that label.
export function agentModelLabel(
  agent: AiAgent,
  providerLabel: (key: string) => string,
  // What an agent with no model chosen reads as.
  noModel: string,
) {
  if (!agent.model) return noModel;
  return agent.modelProvider
    ? `${agent.model} · ${providerLabel(agent.modelProvider)}`
    : agent.model;
}
