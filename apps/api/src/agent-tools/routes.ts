import { Elysia, t } from 'elysia';
import { noContent } from '../shared/http';
import { guards } from '../shared/guards';
import { authContext } from '../shared/auth-context';
import { HttpError } from '../shared/lib';
import { ErrorResponse } from '../shared/responses';
import { mcpTool } from '../mcp/generate';
import { agentInProject } from '../agent-skills/store';
import { AGENT_ACTIONS, ALWAYS_ON_ACTIONS } from '../ai-agents/runtime/tools/catalog';
import {
  listAgentTools,
  createAgentTool,
  deleteAgentTool,
  listAgentToolLinks,
  setAgentTools,
} from './store';

const toolParams = t.Object({ projectKey: t.String(), agentToolId: t.Numeric() });
const agentParams = t.Object({ projectKey: t.String(), agentId: t.Numeric() });

// A built-in agent action in the catalog (ToolMeta from ai-agents/runtime/tools).
// `always` marks the read-only actions granted unconditionally, that cannot be
// toggled off.
const ToolMetaResponse = t.Object({
  key: t.String(),
  label: t.String(),
  description: t.String(),
  always: t.Boolean(),
});

// A configured tool DTO: the tool bound to a credential, enriched with the credential's
// integration and label for display. The tool catalog itself is served by the
// integrations catalog (kind 'tool').
const AgentToolResponse = t.Object({
  id: t.Number(),
  projectId: t.Number(),
  toolKey: t.String(),
  credentialId: t.Number(),
  integrationKey: t.String(),
  credentialLabel: t.Nullable(t.String()),
  createdAt: t.String(),
});

// Two tool systems live under this tag. Built-in agent actions (create_issue,
// search_issues, ...) are the catalog an internal agent is granted through its
// `tools` field; the catalog route is read-only, ai_agents-gated, and exposed over
// MCP. Configured tools bind an external tool to an integration credential; those
// reference secrets, so they are session-only (not MCP tools) and gated under the
// agent_tools resource.
export const agentToolRoutes = new Elysia({
  name: 'agent-tools',
  detail: { tags: ['Agent Tools'] },
})
  .use(authContext)
  .use(guards)

  // The built-in actions an internal agent can be granted, followed by the always-on
  // read-only ones. Feeds the `tools` field on create_ai_agent / update_ai_agent.
  .get('/projects/:projectKey/ai-agents/tools', () => [...AGENT_ACTIONS, ...ALWAYS_ON_ACTIONS], {
    permission: ['ai_agents', 'read'],
    response: {
      200: t.Array(ToolMetaResponse),
      401: ErrorResponse,
      403: ErrorResponse,
      404: ErrorResponse,
    },
    detail: {
      summary: 'List built-in agent actions',
      description:
        'List the built-in actions an internal agent can be granted (the valid keys for the ' +
        'tools field on create_ai_agent / update_ai_agent).',
      ...mcpTool('list_ai_agent_tools'),
    },
  })

  .get('/projects/:projectKey/agent-tools', ({ project }) => listAgentTools(project.id), {
    permission: ['agent_tools', 'read'],
    response: {
      200: t.Array(AgentToolResponse),
      401: ErrorResponse,
      403: ErrorResponse,
      404: ErrorResponse,
    },
    detail: {
      summary: 'List configured tools',
      description: "List a project's tools configured on integration credentials.",
    },
  })

  .post(
    '/projects/:projectKey/agent-tools',
    async ({ project, body, set }) => {
      set.status = 201;
      return createAgentTool(project.id, body);
    },
    {
      body: t.Object({ toolKey: t.String({ minLength: 1 }), credentialId: t.Number() }),
      permission: ['agent_tools', 'create'],
      response: {
        201: AgentToolResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
        409: ErrorResponse,
      },
      detail: {
        summary: 'Configure a tool',
        description: 'Bind a tool to an integration credential.',
      },
    },
  )

  .delete(
    '/projects/:projectKey/agent-tools/:agentToolId',
    async ({ params, project }) => {
      const ok = await deleteAgentTool(params.agentToolId, project.id);
      if (!ok) throw new HttpError(404, 'Configured tool not found');
      return noContent();
    },
    {
      params: toolParams,
      permission: ['agent_tools', 'delete'],
      response: {
        204: t.Void(),
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: { summary: 'Delete a configured tool', description: 'Delete a configured tool.' },
    },
  )

  // Which configured tools are enabled on an agent.
  .get(
    '/projects/:projectKey/ai-agents/:agentId/tool-configs',
    async ({ params, project }) => {
      if (!(await agentInProject(params.agentId, project.id))) {
        throw new HttpError(404, 'Agent not found');
      }
      return listAgentToolLinks(params.agentId);
    },
    {
      params: agentParams,
      permission: ['agent_tools', 'read'],
      response: {
        200: t.Array(AgentToolResponse),
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: "List an agent's enabled tools",
        description: 'List the configured tools enabled on an agent.',
      },
    },
  )

  // Replaces the set of configured tools enabled on an agent.
  .put(
    '/projects/:projectKey/ai-agents/:agentId/tool-configs',
    async ({ params, project, body }) => {
      if (!(await agentInProject(params.agentId, project.id))) {
        throw new HttpError(404, 'Agent not found');
      }
      await setAgentTools(params.agentId, project.id, body.agentToolIds);
      return listAgentToolLinks(params.agentId);
    },
    {
      body: t.Object({ agentToolIds: t.Array(t.Number()) }),
      params: agentParams,
      permission: ['agent_tools', 'edit'],
      response: {
        200: t.Array(AgentToolResponse),
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: "Set an agent's enabled tools",
        description: 'Replace the set of configured tools enabled on an agent.',
      },
    },
  );
