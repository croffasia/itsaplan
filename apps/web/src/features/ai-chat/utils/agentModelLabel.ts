import type { AiAgent } from '@/lib/api';

// The agent's model as shown in the chat UI: the model key plus its provider's
// catalog label. `providerLabel` maps a provider key to that label.
export function agentModelLabel(agent: AiAgent, providerLabel: (key: string) => string) {
  if (!agent.model) return 'No model set';
  return agent.modelProvider
    ? `${agent.model} · ${providerLabel(agent.modelProvider)}`
    : agent.model;
}
