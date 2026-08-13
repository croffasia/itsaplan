import { t } from 'elysia';

export const credentialParams = t.Object({
  projectKey: t.String(),
  credentialId: t.Numeric(),
});

export const providerParams = t.Object({
  projectKey: t.String(),
  provider: t.String({ description: "LLM provider key from list_integrations, e.g. 'anthropic'." }),
});

export const integrationOptionsQuery = t.Object({
  kind: t.Optional(
    t.Union([t.Literal('llm'), t.Literal('tool')], {
      description: 'Only the integrations of this kind.',
    }),
  ),
});

// A stored credential DTO — never carries the secret, only the redacted view.
export const CredentialResponse = t.Object({
  id: t.Number(),
  projectId: t.Number(),
  integrationKey: t.String(),
  label: t.Nullable(t.String()),
  redacted: t.Record(t.String(), t.Any()),
  createdAt: t.String(),
});

export const CredentialListResponse = t.Array(CredentialResponse);

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

export const IntegrationCatalogResponse = t.Array(IntegrationResponse);

export const ProviderModelListResponse = t.Array(t.Object({ id: t.String(), name: t.String() }));

// A connected integration as a picker option: what it is and what it is called.
// Carries no credential fields, redacted or otherwise.
const IntegrationOptionResponse = t.Object({
  id: t.Number(),
  integrationKey: t.String(),
  kind: t.Union([t.Literal('llm'), t.Literal('tool')]),
  label: t.Nullable(t.String()),
});

export const IntegrationOptionListResponse = t.Array(IntegrationOptionResponse);

export const createCredentialBody = t.Object({
  integrationKey: t.String({ minLength: 1 }),
  label: t.Optional(t.Nullable(t.String())),
  credential: t.Record(t.String(), t.Any()),
});

export const updateCredentialBody = t.Object({
  label: t.Optional(t.Nullable(t.String())),
  credential: t.Optional(t.Record(t.String(), t.Any())),
});
