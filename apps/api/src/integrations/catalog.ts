import type { ConfigField } from '@repo/agent-tools';
import { integrationDescriptors } from '@repo/agent-tools';
import { AI_PROVIDERS } from './llm-providers';

// The unified integration catalog: every service a project can store a credential
// for. Two kinds:
//   - "llm"  — the AI providers whose models an internal agent runs on. Their
//              credential is an API key (plus a base URL for OpenAI-compatible
//              endpoints). They expose no tools.
//   - "tool" — the tool integrations (Jina, Firecrawl, Telegram, Threads) from
//              @repo/agent-tools. Their credential schema and tool list come from the
//              package.
// The credential form and, for tool integrations, the tool picker are built from a
// descriptor on the frontend.

export type IntegrationKind = 'llm' | 'tool';

export interface UnifiedIntegration {
  key: string;
  label: string;
  kind: IntegrationKind;
  credentialSchema: ConfigField[];
  tools: { key: string; label: string; description: string; scopes?: string[] }[];
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
  credentialSchema: llmCredentialSchema(p.requiresBaseUrl),
  tools: [],
}));

const TOOL_INTEGRATIONS: UnifiedIntegration[] = integrationDescriptors().map((d) => ({
  key: d.key,
  label: d.label,
  kind: 'tool',
  credentialSchema: d.credentialSchema,
  tools: d.tools,
}));

export const INTEGRATION_CATALOG: UnifiedIntegration[] = [
  ...LLM_INTEGRATIONS,
  ...TOOL_INTEGRATIONS,
];

const BY_KEY = new Map(INTEGRATION_CATALOG.map((i) => [i.key, i]));

// The credential schema for an integration, or undefined for an unknown key.
export function credentialSchemaFor(key: string): ConfigField[] | undefined {
  return BY_KEY.get(key)?.credentialSchema;
}
