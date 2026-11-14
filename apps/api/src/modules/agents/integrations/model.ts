import { t } from 'elysia';
import { pageQueryFields, pageResponse } from '#shared/pagination';

export const credentialParams = t.Object({
  teamId: t.Numeric(),
  credentialId: t.Numeric(),
});

export const providerParams = t.Object({
  teamId: t.Numeric(),
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
  teamId: t.Number(),
  integrationKey: t.String(),
  label: t.Nullable(t.String()),
  redacted: t.Record(t.String(), t.Any()),
  createdAt: t.String(),
});

export const CredentialPageResponse = pageResponse(CredentialResponse);

export const credentialListQuery = t.Object({
  search: t.Optional(
    t.String({
      maxLength: 200,
      description:
        'Case-insensitive match on the integration name, its key or the credential label.',
    }),
  ),
  kind: t.Optional(
    t.String({
      pattern: '^(llm|tool)(,(llm|tool))*$',
      description: 'A comma-separated subset of llm and tool. Omit for all.',
    }),
  ),
  ...pageQueryFields,
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
  icon: t.Optional(
    t.Object(
      { path: t.String(), color: t.Optional(t.String()) },
      { description: 'A brand mark: one SVG path in a 24×24 box and its fill color.' },
    ),
  ),
  website: t.Optional(
    t.String({ description: "The service's homepage; an AI provider's models page." }),
  ),
  credentialOptional: t.Optional(
    t.Boolean({ description: 'Its tools also run with no credential, on a keyless tier.' }),
  ),
  credentialSchema: t.Array(ConfigFieldResponse),
  tools: t.Array(
    t.Object({
      key: t.String(),
      label: t.String(),
      description: t.String(),
      scopes: t.Optional(t.Array(t.String())),
      group: t.Optional(t.String()),
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

export const checkCredentialBody = t.Omit(createCredentialBody, ['label']);

export const checkStoredCredentialBody = t.Object({
  credential: t.Record(t.String(), t.Any(), {
    description: 'Only the fields being changed. Secret fields left out are the stored ones.',
  }),
});

export const CredentialCheckResponse = t.Object({
  result: t.Union(
    [t.Literal('valid'), t.Literal('rejected'), t.Literal('unavailable'), t.Literal('unknown')],
    {
      description:
        'What the service said: "rejected" is a clear refusal, "unavailable" a check that got no clear answer, "unknown" a credential that cannot be checked from here.',
    },
  ),
});
