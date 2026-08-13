import { Elysia, t } from 'elysia';
import { noContent } from '#shared/http';
import { guards } from '#shared/guards';
import { authContext } from '#shared/auth-context';
import { HttpError } from '#shared/lib';
import { accessErrors, commonErrors, errors } from '#shared/responses';
import { mcpTool } from '#mcp/generate';
import { agentInProject } from '../core/service';
import { AGENT_ACTIONS, ALWAYS_ON_ACTIONS } from '../core/runtime/tools/catalog';
import {
  AgentToolListResponse,
  AgentToolResponse,
  ToolMetaListResponse,
  agentParams,
  createAgentToolBody,
  setAgentToolsBody,
  toolParams,
} from './model';
import {
  listAgentTools,
  createAgentTool,
  deleteAgentTool,
  listAgentToolLinks,
  setAgentTools,
} from './service';

// Two tool systems live under this tag. Built-in agent actions (create_issue,
// search_issues, ...) are the catalog an internal agent is granted through its
// `tools` field; the catalog route is read-only and ai_agents-gated. Configured tools
// bind an external tool to an integration credential and are gated under the
// agent_tools resource; binding one to a credential is done in the UI, so only reading
// them and enabling them on an agent are exposed over MCP.
export const agentToolRoutes = new Elysia({
  name: 'agent-tools',
  detail: { tags: ['Agent Tools'] },
})
  .use(authContext)
  .use(guards)

  .get('/projects/:projectKey/ai-agents/tools', () => [...AGENT_ACTIONS, ...ALWAYS_ON_ACTIONS], {
    permission: ['ai_agents', 'read'],
    response: { 200: ToolMetaListResponse, ...accessErrors },
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
    response: { 200: AgentToolListResponse, ...accessErrors },
    detail: {
      summary: 'List configured tools',
      description:
        "List a project's tools configured on integration credentials. An id here is what " +
        'set_ai_agent_configured_tools takes to enable a tool on an agent. Separate from the ' +
        'built-in actions in list_ai_agent_tools.',
      ...mcpTool('list_configured_tools'),
    },
  })

  .post(
    '/projects/:projectKey/agent-tools',
    async ({ project, body, set }) => {
      set.status = 201;
      return createAgentTool(project.id, body);
    },
    {
      body: createAgentToolBody,
      permission: ['agent_tools', 'create'],
      response: { 201: AgentToolResponse, ...commonErrors, ...errors(409) },
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
      response: { 204: t.Void(), ...accessErrors },
      detail: { summary: 'Delete a configured tool', description: 'Delete a configured tool.' },
    },
  )

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
      response: { 200: AgentToolListResponse, ...accessErrors },
      detail: {
        summary: "List an agent's enabled tools",
        description: 'List the configured tools enabled on an agent.',
        ...mcpTool('list_ai_agent_configured_tools'),
      },
    },
  )

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
      body: setAgentToolsBody,
      params: agentParams,
      permission: ['agent_tools', 'edit'],
      response: { 200: AgentToolListResponse, ...commonErrors },
      detail: {
        summary: "Set an agent's enabled tools",
        description:
          'Replace the set of configured tools enabled on an agent. Send the full set: a tool ' +
          'left out is disabled.',
        ...mcpTool('set_ai_agent_configured_tools'),
      },
    },
  );
