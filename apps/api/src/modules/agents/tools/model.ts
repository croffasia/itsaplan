import { t } from 'elysia';
import { pageQueryFields, pageResponse } from '#shared/pagination';

export { agentParams } from '../model';

export const toolParams = t.Object({
  teamId: t.Numeric(),
  agentToolId: t.Numeric({ description: 'Configured tool id from list_configured_tools.' }),
});

// A built-in agent action in the catalog (ToolMeta from ../core/runtime/tools).
// `always` marks the read-only actions granted unconditionally, that cannot be
// toggled off.
const ToolMetaResponse = t.Object({
  key: t.String(),
  group: t.String(),
  label: t.String(),
  description: t.String(),
  always: t.Boolean(),
  // [resource, action] on the role matrix, from the route behind the action. Absent
  // when no route backs it, or when its route asks only for project membership.
  // A bounded array rather than t.Tuple: TypeBox writes a tuple as draft-7's
  // `items: [...]`, which the OpenAPI 3.0 schema object does not allow.
  permission: t.Optional(t.Array(t.String(), { minItems: 2, maxItems: 2 })),
});

export const ToolMetaListResponse = t.Array(ToolMetaResponse);

// The tool catalog itself is served by the integrations catalog (kind 'tool').
export const AgentToolResponse = t.Object({
  id: t.Number(),
  teamId: t.Number(),
  toolKey: t.String(),
  credentialId: t.Number(),
  integrationKey: t.String(),
  credentialLabel: t.Nullable(t.String()),
  createdAt: t.String(),
});

export const AgentToolListResponse = t.Array(AgentToolResponse);

export const AgentToolPageResponse = pageResponse(AgentToolResponse);

export const agentToolListQuery = t.Object(pageQueryFields);

export const createAgentToolBody = t.Object({
  toolKey: t.String({ minLength: 1 }),
  credentialId: t.Number(),
});

export const setAgentToolsBody = t.Object({
  agentToolIds: t.Array(t.Number(), {
    description: 'Configured tool ids from list_configured_tools.',
  }),
});
