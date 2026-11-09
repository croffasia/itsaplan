import { Elysia, t } from 'elysia';
import { noContent } from '#shared/http';
import { guards } from '#shared/guards';
import { authContext } from '#shared/auth-context';
import { HttpError } from '#shared/lib';
import { accessErrors, commonErrors } from '#shared/responses';
import { mcpTool } from '#mcp/generate';
import { paginate } from '#shared/pagination';
import { teamParams } from '#modules/teams/model';
import { integrationCatalog, integrationKind } from './catalog';
import { listModelsForProvider } from './provider-models';
import {
  CredentialPageResponse,
  credentialListQuery,
  CredentialResponse,
  IntegrationCatalogResponse,
  IntegrationOptionListResponse,
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
  // member: the catalog holds no team data.
  .get('/teams/:teamId/integrations/catalog', () => integrationCatalog(), {
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
