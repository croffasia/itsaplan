import { t } from 'elysia';

// Shared by every route in the domain that addresses an agent by its id.
export const agentParams = t.Object({
  projectKey: t.String(),
  agentId: t.Numeric({ description: 'Agent id from list_ai_agents.' }),
});
