import { Elysia, t } from 'elysia';
import { noContent } from '../shared/http';
import { guards } from '../shared/guards';
import { authContext } from '../shared/auth-context';
import { HttpError } from '../shared/lib';
import { ErrorResponse } from '../shared/responses';
import { INTEGRATION_CATALOG } from './catalog';
import { listModelsForProvider } from './models';
import { listCredentials, createCredential, updateCredential, deleteCredential } from './store';

const credentialParams = t.Object({ projectKey: t.String(), credentialId: t.Numeric() });

// A stored credential DTO — never carries the secret, only the redacted view.
const CredentialResponse = t.Object({
  id: t.Number(),
  projectId: t.Number(),
  integrationKey: t.String(),
  label: t.Nullable(t.String()),
  redacted: t.Record(t.String(), t.Any()),
  createdAt: t.String(),
});

const ConfigFieldResponse = t.Object({
  key: t.String(),
  label: t.String(),
  type: t.String(),
  required: t.Boolean(),
  placeholder: t.Optional(t.String()),
  help: t.Optional(t.String()),
});

const IntegrationResponse = t.Object({
  key: t.String(),
  label: t.String(),
  kind: t.String(),
  credentialSchema: t.Array(ConfigFieldResponse),
  tools: t.Array(
    t.Object({
      key: t.String(),
      label: t.String(),
      description: t.String(),
      scopes: t.Optional(t.Array(t.String())),
    }),
  ),
});

const ProviderModelResponse = t.Object({ id: t.String(), name: t.String() });

// Integration credentials carry secrets, so these routes are managed only through the
// session UI and are not exposed as MCP tools. Gated under the integrations resource.
export const integrationRoutes = new Elysia({
  name: 'integrations',
  detail: { tags: ['Integrations'] },
})
  .use(authContext)
  .use(guards)

  // The catalog of integrations (LLM providers + tool integrations). The frontend
  // builds the credential form from credentialSchema.
  .get('/projects/:projectKey/integrations/catalog', () => INTEGRATION_CATALOG, {
    permission: ['integrations', 'read'],
    response: {
      200: t.Array(IntegrationResponse),
      401: ErrorResponse,
      403: ErrorResponse,
      404: ErrorResponse,
    },
    detail: {
      summary: 'List available integrations',
      description: 'List the integration catalog: LLM providers and tool integrations.',
    },
  })

  // The models an LLM provider offers, from the models.dev registry. Backs the model
  // select in the agent config UI. Empty when the registry is unavailable.
  .get(
    '/projects/:projectKey/integrations/models/:provider',
    ({ params }) => listModelsForProvider(params.provider),
    {
      params: t.Object({ projectKey: t.String(), provider: t.String() }),
      permission: ['integrations', 'read'],
      response: {
        200: t.Array(ProviderModelResponse),
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: "List a provider's models",
        description: 'List the models an LLM provider offers.',
      },
    },
  )

  .get('/projects/:projectKey/integrations', ({ project }) => listCredentials(project.id), {
    permission: ['integrations', 'read'],
    response: {
      200: t.Array(CredentialResponse),
      401: ErrorResponse,
      403: ErrorResponse,
      404: ErrorResponse,
    },
    detail: {
      summary: 'List credentials',
      description: "List a project's integration credentials (secrets redacted).",
    },
  })

  .post(
    '/projects/:projectKey/integrations',
    async ({ project, body, set }) => {
      set.status = 201;
      return createCredential(project.id, body);
    },
    {
      body: t.Object({
        integrationKey: t.String({ minLength: 1 }),
        label: t.Optional(t.Nullable(t.String())),
        credential: t.Record(t.String(), t.Any()),
      }),
      permission: ['integrations', 'create'],
      response: {
        201: CredentialResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
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
      body: t.Object({
        label: t.Optional(t.Nullable(t.String())),
        credential: t.Optional(t.Record(t.String(), t.Any())),
      }),
      params: credentialParams,
      permission: ['integrations', 'edit'],
      response: {
        200: CredentialResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
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
      response: {
        204: t.Void(),
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: 'Delete a credential',
        description: 'Delete an integration credential.',
      },
    },
  );
