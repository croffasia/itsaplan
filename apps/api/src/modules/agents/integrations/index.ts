import { Elysia, t } from 'elysia';
import { noContent } from '#shared/http';
import { guards } from '#shared/guards';
import { authContext } from '#shared/auth-context';
import { HttpError } from '#shared/lib';
import { accessErrors, commonErrors } from '#shared/responses';
import { mcpTool } from '#mcp/generate';
import { INTEGRATION_CATALOG, integrationKind } from './catalog';
import { listModelsForProvider } from './provider-models';
import {
  CredentialListResponse,
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
import { listCredentials, createCredential, updateCredential, deleteCredential } from './service';

// The credential store is gated under the integrations resource; the catalog, the
// provider models and the picker options carry no project secrets and are open to
// any member. The reads are exposed as MCP tools, so an internal agent's provider
// and model can be picked without the UI; the writes are not, because a credential
// body carries the provider's secret in plain text.
export const integrationRoutes = new Elysia({
  name: 'integrations',
  detail: { tags: ['Integrations'] },
})
  .use(authContext)
  .use(guards)

  // The frontend builds the credential form from credentialSchema. Open to any
  // project member: the catalog is a constant in this codebase, not project data.
  .get('/projects/:projectKey/integrations/catalog', () => INTEGRATION_CATALOG, {
    projectMember: true,
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
  // select in the agent config UI. Open to any project member: the list comes from a
  // public registry and holds no project data.
  .get(
    '/projects/:projectKey/integrations/models/:provider',
    ({ params }) => listModelsForProvider(params.provider),
    {
      params: providerParams,
      projectMember: true,
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

  // Fills the credential selects in the agent and tool forms. Open to any project
  // member, and deliberately separate from the credential list above: that one is
  // the integrations admin view and may grow fields this one must not carry.
  .get(
    '/projects/:projectKey/integrations/options',
    async ({ project, query }) => {
      const credentials = await listCredentials(project.id);
      return credentials.flatMap((c) => {
        const kind = integrationKind(c.integrationKey);
        if (!kind || (query.kind && kind !== query.kind)) return [];
        return [{ id: c.id, integrationKey: c.integrationKey, kind, label: c.label }];
      });
    },
    {
      query: integrationOptionsQuery,
      projectMember: true,
      response: { 200: IntegrationOptionListResponse, ...commonErrors },
      detail: {
        summary: 'List integration options',
        description:
          "The project's connected integrations as picker options: id, key, kind and label.",
      },
    },
  )

  .get('/projects/:projectKey/integrations', ({ project }) => listCredentials(project.id), {
    permission: ['integrations', 'read'],
    response: { 200: CredentialListResponse, ...accessErrors },
    detail: {
      summary: 'List credentials',
      description:
        "List a project's integration credentials, secrets redacted. The id of a credential " +
        'on an LLM provider is what modelCredentialId on create_ai_agent / update_ai_agent takes. ' +
        'A credential is added in the UI, not here.',
      ...mcpTool('list_integration_credentials'),
    },
  })

  .post(
    '/projects/:projectKey/integrations',
    async ({ project, body, set }) => {
      set.status = 201;
      return createCredential(project.id, body);
    },
    {
      body: createCredentialBody,
      permission: ['integrations', 'create'],
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
    '/projects/:projectKey/integrations/:credentialId',
    async ({ params, project, body }) => {
      const row = await updateCredential(params.credentialId, project.id, body);
      if (!row) throw new HttpError(404, 'Credential not found');
      return row;
    },
    {
      body: updateCredentialBody,
      params: credentialParams,
      permission: ['integrations', 'edit'],
      response: { 200: CredentialResponse, ...commonErrors },
      detail: {
        summary: 'Update a credential',
        description: "Update a credential's label or secret. The integration is fixed.",
      },
    },
  )

  .delete(
    '/projects/:projectKey/integrations/:credentialId',
    async ({ params, project }) => {
      const ok = await deleteCredential(params.credentialId, project.id);
      if (!ok) throw new HttpError(404, 'Credential not found');
      return noContent();
    },
    {
      params: credentialParams,
      permission: ['integrations', 'delete'],
      response: { 204: t.Void(), ...accessErrors },
      detail: {
        summary: 'Delete a credential',
        description: 'Delete an integration credential.',
      },
    },
  );
