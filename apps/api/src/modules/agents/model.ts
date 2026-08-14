import { t } from 'elysia';

// Shared by every route in the domain that addresses an agent by its id.
export const agentParams = t.Object({
  projectKey: t.String(),
  agentId: t.Numeric({ description: 'Agent id from list_ai_agents.' }),
});

// What started a run, in the run history and in the queue a runner drains.
export const agentRunTrigger = t.Union([
  t.Literal('mention'),
  t.Literal('delegation'),
  t.Literal('schedule'),
  t.Literal('manual'),
]);

export type AgentRunTrigger = typeof agentRunTrigger.static;
