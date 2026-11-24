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
        'List the built-in actions you can grant an internal agent: the valid `tools` keys for ' +
        'create_ai_agent and update_ai_agent. Each shows the permission it checks. An action the ' +
        "agent's role does not allow returns 403 when it runs.",
      ...mcpTool('list_ai_agent_tools'),
    },
  })

  .get(
    '/teams/:teamId/agent-tools',
    ({ membership, query }) =>
      paginate(query, (window) =>
        listAgentTools(membership.teamId, window, {
          search: query.search,
          groups: query.group?.split(','),
        }),
      ),
    {
      params: teamParams,
      query: agentToolListQuery,
      teamPermission: ['agent_tools', 'read'],
      response: { 200: AgentToolPageResponse, ...commonErrors },
      detail: {
        summary: 'List configured tools',
        description:
          "List a team's tools configured on integration credentials, one page at a time. Enable " +
          'one on an agent with set_ai_agent_configured_tools. Built-in actions are in ' +
          'list_ai_agent_tools. For the full list at once, use list_configured_tool_options.',
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
          "List all of a team's configured tools at once. Use list_configured_tools for pages.",
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
        description:
          'Bind a tool to an integration credential. A tool whose integration needs no ' +
          'credential is configured without one.',
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
      return listAgentToolLinks(params.agentId, membership.teamId);
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
      return listAgentToolLinks(params.agentId, membership.teamId);
    },
    {
      body: setAgentToolsBody,
      params: agentParams,
      teamPermission: ['agent_tools', 'edit'],
      response: { 200: AgentToolListResponse, ...commonErrors },
      detail: {
        summary: "Set an agent's enabled tools",
        description:
          'Replace the configured tools enabled on an agent. Send the full set: a tool not in it ' +
          "is disabled. Ids that are not tools of the agent's team are ignored.",
        ...mcpTool('set_ai_agent_configured_tools'),
      },
    },
  );
