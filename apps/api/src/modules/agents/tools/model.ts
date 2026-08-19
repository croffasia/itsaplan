import { t } from 'elysia';

export { agentParams } from '../model';

export const toolParams = t.Object({ projectKey: t.String(), agentToolId: t.Numeric() });

// A built-in agent action in the catalog (ToolMeta from ../core/runtime/tools).
// `always` marks the read-only actions granted unconditionally, that cannot be
// toggled off.
const ToolMetaResponse = t.Object({
  key: t.String(),
  group: t.String(),
  label: t.String(),
  description: t.String(),
  always: t.Boolean(),
});

export const ToolMetaListResponse = t.Array(ToolMetaResponse);

// The tool catalog itself is served by the integrations catalog (kind 'tool').
export const AgentToolResponse = t.Object({
  id: t.Number(),
  projectId: t.Number(),
  toolKey: t.String(),
  credentialId: t.Number(),
  integrationKey: t.String(),
  credentialLabel: t.Nullable(t.String()),
  createdAt: t.String(),
});

export const AgentToolListResponse = t.Array(AgentToolResponse);

export const createAgentToolBody = t.Object({
  toolKey: t.String({ minLength: 1 }),
  credentialId: t.Number(),
});

export const setAgentToolsBody = t.Object({
  agentToolIds: t.Array(t.Number(), {
    description: 'Configured tool ids from list_configured_tools.',
  }),
});
