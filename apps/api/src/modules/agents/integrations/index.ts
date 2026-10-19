import { Elysia, t } from 'elysia';
import { noContent } from '#shared/http';
import { guards } from '#shared/guards';
import { authContext, requestUser } from '#shared/auth-context';
import { requireUser } from '#shared/access';
import { HttpError } from '#shared/lib';
import { accessErrors, commonErrors, errors } from '#shared/responses';
import { mcpTool } from '#mcp/generate';
import { paginate } from '#shared/pagination';
import { teamParams } from '#modules/teams/model';
import { MCP_TOOL_PREFIX } from '@repo/agent-tools';
import { INTEGRATION_CATALOG, integrationKind } from './catalog';
import { listModelsForProvider } from './provider-models';
import {
  CredentialPageResponse,
  credentialListQuery,
  CredentialResponse,
  IntegrationCatalogResponse,
  IntegrationOptionListResponse,
  McpSignInResponse,
  McpToolListResponse,
  mcpCallbackQuery,
  ProviderModelListResponse,
  createCredentialBody,
  credentialParams,
  integrationOptionsQuery,
  providerParams,
  updateCredentialBody,
} from './model';
import {
  listCredentials,
  listAllCredentials,
  createCredential,
  updateCredential,
  deleteCredential,
} from './service';
import { finishMcpSignIn, listCredentialMcpTools, startMcpSignIn } from './mcp';

// The credential store belongs to the team and serves every project it owns, so every
// route sits under :teamId, gated by the integrations resource on the team: its owner
// and managers always, an owner of one of its projects always, another member when a
// project role of theirs grants it. The catalog, a provider's models and the picker
// options are open to any team member — the first two are constants of this codebase
// and a public registry, and the options carry no credential field. The writes are not
// exposed as MCP tools, because a credential body carries the provider's secret in
// plain text.
export const integrationRoutes = new Elysia({
  name: 'integrations',
  detail: { tags: ['Integrations'] },
})
  .use(authContext)
  .use(guards)

  // The frontend builds the credential form from credentialSchema. Open to any team
  // member: the catalog is a constant in this codebase, not team data.
  .get('/teams/:teamId/integrations/catalog', () => INTEGRATION_CATALOG, {
    params: teamParams,
    teamMember: true,
    response: { 200: IntegrationCatalogResponse, ...accessErrors },
    detail: {
      summary: 'List available integrations',
      description:
        "List the integration catalog: LLM providers (kind 'llm') and tool integrations " +
        "(kind 'tool'). A provider key here is what list_provider_models takes.",
      ...mcpTool('list_integrations'),
    },
  })

  // The models an LLM provider offers, from the models.dev registry. Backs the model
  // select in the agent config UI. Open to any team member: the list comes from a
  // public registry and holds no team data.
  .get(
    '/teams/:teamId/integrations/models/:provider',
    ({ params }) => listModelsForProvider(params.provider),
    {
      params: providerParams,
      teamMember: true,
      response: { 200: ProviderModelListResponse, ...accessErrors },
      detail: {
        summary: "List a provider's models",
        description:
          'List the models an LLM provider offers. An id here is what the model field on ' +
          'create_ai_agent / update_ai_agent takes. Empty when the model registry is unreachable.',
        // The list comes from models.dev, the one route here that reads outside the tracker.
        ...mcpTool('list_provider_models', { openWorldHint: true }),
      },
    },
  )

  // Fills the credential selects in the agent and tool forms. Open to any team member,
  // and deliberately separate from the credential list below: that one is the
  // integrations admin view and may grow fields this one must not carry.
  .get(
    '/teams/:teamId/integrations/options',
    async ({ membership, query }) => {
      const credentials = await listAllCredentials(membership.teamId);
      return credentials.flatMap((c) => {
        const kind = integrationKind(c.integrationKey);
        if (!kind || (query.kind && kind !== query.kind)) return [];
        return [{ id: c.id, integrationKey: c.integrationKey, kind, label: c.label }];
      });
    },
    {
      params: teamParams,
      query: integrationOptionsQuery,
      teamMember: true,
      response: { 200: IntegrationOptionListResponse, ...commonErrors },
      detail: {
        summary: 'List integration options',
        description:
          "The team's connected integrations as picker options: id, key, kind and label.",
      },
    },
  )

  .get(
    '/teams/:teamId/integrations',
    ({ membership, query }) =>
      paginate(query, (window) => listCredentials(membership.teamId, window)),
    {
      params: teamParams,
      query: credentialListQuery,
      teamPermission: ['integrations', 'read'],
      response: { 200: CredentialPageResponse, ...accessErrors },
      detail: {
        summary: 'List credentials',
        description:
          "One page of a team's integration credentials, secrets redacted. The id of a " +
          'credential on an LLM provider is what modelCredentialId on create_ai_agent / ' +
          'update_ai_agent takes. A credential is added in the UI, not here.',
        ...mcpTool('list_integration_credentials'),
      },
    },
  )

  // Backs the dialog that configures tools, so it carries that dialog's permission.
  .get(
    '/teams/:teamId/integrations/:credentialId/mcp-tools',
    async ({ params, membership }) => {
      const tools = await listCredentialMcpTools(params.credentialId, membership.teamId);
      if (!tools) throw new HttpError(404, 'MCP server credential not found');
      return tools.map((tool) => ({
        key: MCP_TOOL_PREFIX + tool.name,
        label: tool.title ?? tool.name,
        description: tool.description ?? '',
      }));
    },
    {
      params: credentialParams,
      teamPermission: ['agent_tools', 'create'],
      response: { 200: McpToolListResponse, ...commonErrors },
      detail: {
        summary: "List an MCP server's tools",
        description: 'The tools an MCP server credential offers, read from the server.',
      },
    },
  )

  // Answers with the URL rather than redirecting, because the browser calls it over fetch.
  .post(
    '/teams/:teamId/integrations/:credentialId/mcp-sign-in',
    async ({ params, membership, user }) => {
      const url = await startMcpSignIn(
        params.credentialId,
        membership.teamId,
        requireUser(user).id,
      );
      if (!url) throw new HttpError(404, 'MCP server credential not found');
      return { url };
    },
    {
      params: credentialParams,
      teamPermission: ['integrations', 'edit'],
      response: { 200: McpSignInResponse, ...commonErrors },
      detail: {
        summary: 'Sign in to an MCP server',
        description: 'Start the OAuth sign-in of an MCP server credential.',
      },
    },
  )

  .post(
    '/teams/:teamId/integrations',
    async ({ membership, body, set }) => {
      set.status = 201;
      return createCredential(membership.teamId, body);
    },
    {
      params: teamParams,
      body: createCredentialBody,
      teamPermission: ['integrations', 'create'],
      response: { 201: CredentialResponse, ...commonErrors },
      detail: {
        summary: 'Add a credential',
        description: 'Store a credential for an integration.',
      },
    },
  )

  // Updates the label and/or the credential. Secret fields left out of `credential`
  // keep their stored value. The integration is fixed once created (delete + re-add).
  .patch(
    '/teams/:teamId/integrations/:credentialId',
    async ({ params, membership, body }) => {
      const row = await updateCredential(params.credentialId, membership.teamId, body);
      if (!row) throw new HttpError(404, 'Credential not found');
      return row;
    },
    {
      body: updateCredentialBody,
      params: credentialParams,
      teamPermission: ['integrations', 'edit'],
      response: { 200: CredentialResponse, ...commonErrors },
      detail: {
        summary: 'Update a credential',
        description: "Update a credential's label or secret. The integration is fixed.",
      },
    },
  )

  .delete(
    '/teams/:teamId/integrations/:credentialId',
    async ({ params, membership }) => {
      const ok = await deleteCredential(params.credentialId, membership.teamId);
      if (!ok) throw new HttpError(404, 'Credential not found');
      return noContent();
    },
    {
      params: credentialParams,
      teamPermission: ['integrations', 'delete'],
      response: { 204: t.Void(), ...accessErrors },
      detail: {
        summary: 'Delete a credential',
        description: 'Delete an integration credential.',
      },
    },
  );

// The encrypted `state` names the credential and the account that started the sign-in,
// which must be the one the request's session belongs to. Mounted on the root app,
// outside the planner's guard.
export const mcpSignInCallbackRoutes = new Elysia({
  name: 'integrations-mcp-callback',
  detail: { tags: ['Integrations'] },
}).get(
  '/integrations/mcp/callback',
  async ({ query, request }) => {
    const location = await finishMcpSignIn(query, (await requestUser(request))?.id);
    return new Response(null, { status: 302, headers: { location } });
  },
  {
    query: mcpCallbackQuery,
    response: errors(400, 403),
    detail: {
      summary: 'Finish an MCP server sign-in',
      description: 'The OAuth redirect target. Stores the tokens and returns to the web app.',
    },
  },
);
