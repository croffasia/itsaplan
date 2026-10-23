import { Elysia, t } from 'elysia';
import { noContent } from '#shared/http';
import { guards } from '#shared/guards';
import { authContext } from '#shared/auth-context';
import { HttpError } from '#shared/lib';
import { accessErrors, commonErrors, errors } from '#shared/responses';
import { mcpTool } from '#mcp/generate';
import { paginate } from '#shared/pagination';
import { teamParams } from '#modules/teams/model';
import { agentInTeam, agentScopeOf, assertFullAgentAccess } from '../core/service';
import { actionCatalog } from '../core/runtime/tools/route-tools';
import {
  AgentToolListResponse,
  AgentToolPageResponse,
  agentToolListQuery,
  AgentToolResponse,
  ToolMetaListResponse,
  agentParams,
  createAgentToolBody,
  setAgentToolsBody,
  toolParams,
} from './model';
import {
  listAgentTools,
  listAgentToolOptions,
  createAgentTool,
  deleteAgentTool,
  listAgentToolLinks,
  setAgentTools,
} from './service';

// Two tool systems live under this tag. Built-in agent actions (create_issue,
// search_issues, ...) are the catalog an internal agent is granted through its
// `tools` field; the catalog route is read-only and ai_agents-gated. Configured tools
// bind an external tool to an integration credential; the credential belongs to the
// team, so they do too, and their routes sit under :teamId, gated by the agent_tools
// resource on the team. Binding one to a credential is done in the UI, so only reading
// them and enabling them on an agent are exposed over MCP.
//
// Which tools an agent has enabled sits under :teamId too — the agent belongs to the
// team, and only that team's tools may be enabled on it.
export const agentToolRoutes = new Elysia({
  name: 'agent-tools',
  detail: { tags: ['Agent Tools'] },
})
  .use(authContext)
  .use(guards)

  .get('/teams/:teamId/ai-agents/tools', () => actionCatalog(), {
    params: teamParams,
    teamPermission: ['ai_agents', 'read'],
    response: { 200: ToolMetaListResponse, ...accessErrors },
    detail: {
      summary: 'List built-in agent actions',
      description:
        'List the built-in actions an internal agent can be granted (the valid keys for the ' +
        'tools field on create_ai_agent / update_ai_agent), each with the permission its ' +
        "route asserts — an action the agent's role refuses returns 403 when it runs.",
      ...mcpTool('list_ai_agent_tools'),
    },
  })

  .get(
    '/teams/:teamId/agent-tools',
    ({ membership, query }) =>
      paginate(query, (window) => listAgentTools(membership.teamId, window)),
    {
      params: teamParams,
      query: agentToolListQuery,
      teamPermission: ['agent_tools', 'read'],
      response: { 200: AgentToolPageResponse, ...accessErrors },
      detail: {
        summary: 'List configured tools',
        description:
          "One page of a team's tools configured on integration credentials. An id here is " +
          'what set_ai_agent_configured_tools takes to enable a tool on an agent. Separate ' +
          'from the built-in actions in list_ai_agent_tools. The whole list, for a picker, ' +
          'comes from list_configured_tool_options.',
        ...mcpTool('list_configured_tools'),
      },
    },
  )

  .get(
    '/teams/:teamId/agent-tools/options',
    ({ membership }) => listAgentToolOptions(membership.teamId),
    {
      params: teamParams,
      teamPermission: ['agent_tools', 'read'],
      response: { 200: AgentToolListResponse, ...accessErrors },
      detail: {
        summary: 'List every configured tool',
        description:
          "A team's whole list of configured tools, for the picker that enables them on an " +
          'agent. Use list_configured_tools to read it a page at a time.',
        ...mcpTool('list_configured_tool_options'),
      },
    },
  )

  .post(
    '/teams/:teamId/agent-tools',
    async ({ membership, body, set }) => {
      set.status = 201;
      return createAgentTool(membership.teamId, body);
    },
    {
      params: teamParams,
      body: createAgentToolBody,
      teamPermission: ['agent_tools', 'create'],
      response: { 201: AgentToolResponse, ...commonErrors, ...errors(409) },
      detail: {
        summary: 'Configure a tool',
        description: 'Bind a tool to an integration credential.',
      },
    },
  )

  .delete(
    '/teams/:teamId/agent-tools/:agentToolId',
    async ({ params, membership }) => {
      const ok = await deleteAgentTool(params.agentToolId, membership.teamId);
      if (!ok) throw new HttpError(404, 'Configured tool not found');
      return noContent();
    },
    {
      params: toolParams,
      teamPermission: ['agent_tools', 'delete'],
      response: { 204: t.Void(), ...accessErrors },
      detail: { summary: 'Delete a configured tool', description: 'Delete a configured tool.' },
    },
  )

  .get(
    '/teams/:teamId/ai-agents/:agentId/tool-configs',
    async ({ params, membership }) => {
      if (!(await agentInTeam(params.agentId, membership.teamId, agentScopeOf(membership)))) {
        throw new HttpError(404, 'Agent not found');
      }
      return listAgentToolLinks(params.agentId);
    },
    {
      params: agentParams,
      teamPermission: ['agent_tools', 'read'],
      response: { 200: AgentToolListResponse, ...accessErrors },
      detail: {
        summary: "List an agent's enabled tools",
        description: 'List the configured tools enabled on an agent.',
        ...mcpTool('list_ai_agent_configured_tools'),
      },
    },
  )

  .put(
    '/teams/:teamId/ai-agents/:agentId/tool-configs',
    async ({ params, membership, body }) => {
      if (!(await agentInTeam(params.agentId, membership.teamId, agentScopeOf(membership)))) {
        throw new HttpError(404, 'Agent not found');
      }
      await assertFullAgentAccess(membership, params.agentId);
      await setAgentTools(params.agentId, membership.teamId, body.agentToolIds);
      return listAgentToolLinks(params.agentId);
    },
    {
      body: setAgentToolsBody,
      params: agentParams,
      teamPermission: ['agent_tools', 'edit'],
      response: { 200: AgentToolListResponse, ...commonErrors },
      detail: {
        summary: "Set an agent's enabled tools",
        description:
          'Replace the set of configured tools enabled on an agent. Send the full set: a tool ' +
          "left out is disabled. Ids that are not tools of the agent's team are ignored.",
        ...mcpTool('set_ai_agent_configured_tools'),
      },
    },
  );
