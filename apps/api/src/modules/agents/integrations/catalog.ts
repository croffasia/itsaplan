import { getProviderConfig } from '@mastra/core/llm';
import type { ConfigField, IntegrationIcon } from '@repo/agent-tools';
import { integrationDescriptors } from '@repo/agent-tools';
import { AI_PROVIDERS } from './llm-providers';

// The unified integration catalog: every service a project can store a credential
// for. Three kinds:
//   - "llm"     — the AI providers whose models an internal agent runs on. Their
//                 credential is an API key (plus a base URL for OpenAI-compatible
//                 endpoints). They expose no tools.
//   - "tool"    — the tool integrations (Jina, Firecrawl, Telegram, Threads) from
//                 @repo/agent-tools. Their credential schema and tool list come from the
//                 package.
//   - "service" — an address and a key that a team's own tools send requests to, from
//                 an extension of the api (setExtraIntegrations). No tools; its own
//                 verify checks a credential, as a tool integration's does.
// A tool integration another edition of the app runs is listed `locked`: what it is and
// what its tools do, with no credential or tool of it to add here.
// The credential form and, for tool integrations, the tool picker are built from a
// descriptor on the frontend.

export type IntegrationKind = 'llm' | 'tool' | 'service';

export interface UnifiedIntegration {
  key: string;
  label: string;
  kind: IntegrationKind;
  description?: string;
  // A tool integration's brand mark. AI providers have none: there are too many to keep.
  icon?: IntegrationIcon;
  // The service's homepage. For an AI provider, its models page in Mastra's registry.
  website?: string;
  credentialSchema: ConfigField[];
  credentialOptional?: boolean;
  tools: {
    key: string;
    label: string;
    description: string;
    scopes?: string[];
    group?: string;
  }[];
  locked?: boolean;
}

// The credential fields of an LLM provider: an API key, plus a base URL for the
// OpenAI-compatible providers that require one.
function llmCredentialSchema(requiresBaseUrl: boolean): ConfigField[] {
  const fields: ConfigField[] = [
    { key: 'apiKey', label: 'API key', type: 'secret', required: true, placeholder: 'sk-…' },
  ];
  if (requiresBaseUrl) {
    fields.push({
      key: 'baseUrl',
      label: 'Base URL',
      type: 'url',
      required: true,
      placeholder: 'https://your-endpoint/v1',
    });
  }
  return fields;
}

const LLM_INTEGRATIONS: UnifiedIntegration[] = AI_PROVIDERS.map((p) => ({
  key: p.key,
  label: p.label,
  kind: 'llm',
  website: getProviderConfig(p.key)?.docUrl,
  credentialSchema: llmCredentialSchema(p.requiresBaseUrl),
  tools: [],
}));

// Built on each call: an extension of the api adds integrations after this module loads
// (setExtraIntegrations in @repo/agent-tools).
export function integrationCatalog(): UnifiedIntegration[] {
  const tools: UnifiedIntegration[] = integrationDescriptors().map((d) => ({
    key: d.key,
    label: d.label,
    kind: d.kind,
    description: d.description,
    icon: d.icon,
    website: d.website,
    credentialSchema: d.credentialSchema,
    credentialOptional: d.credentialOptional,
    tools: d.tools,
    locked: d.locked,
  }));
  return [...LLM_INTEGRATIONS, ...tools];
}

// An integration a credential can be stored for: a locked one is left out.
export function findIntegration(key: string): UnifiedIntegration | undefined {
  return integrationCatalog().find((i) => i.key === key && !i.locked);
}

// The credential schema for an integration, or undefined for a key no credential is stored for.
export function credentialSchemaFor(key: string): ConfigField[] | undefined {
  return findIntegration(key)?.credentialSchema;
}

// The kind of an integration, or undefined for a key no credential is stored for.
export function integrationKind(key: string): IntegrationKind | undefined {
  return findIntegration(key)?.kind;
}
