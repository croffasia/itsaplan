import type {
  Integration,
  IntegrationDescriptor,
  CustomToolEntry,
  ConfigField,
  ToolConfig,
} from './types';
import { ToolConfigError } from './errors';
import { jina } from './tools/jina';
import { firecrawl } from './tools/firecrawl';
import { telegram } from './tools/telegram';
import { threads } from './tools/threads';
import { instagram } from './tools/instagram';

// The registry of tool integrations. Add an integration by creating its folder under
// tools/ and listing it here.
export const INTEGRATIONS: Integration[] = [jina, firecrawl, telegram, threads, instagram];

const BY_KEY = new Map(INTEGRATIONS.map((i) => [i.key, i]));

// Every tool across all integrations, mapped to its integration for credential
// lookup. Tool keys are unique across integrations; a collision would drop a tool
// from the index, so it fails at module load instead.
const TOOL_INDEX = new Map<string, { integration: Integration; tool: CustomToolEntry }>();
for (const integration of INTEGRATIONS) {
  for (const tool of integration.tools) {
    const clash = TOOL_INDEX.get(tool.key);
    if (clash) {
      throw new Error(
        `Duplicate tool key "${tool.key}" in ${integration.key} and ${clash.integration.key}.`,
      );
    }
    TOOL_INDEX.set(tool.key, { integration, tool });
  }
}

export function getIntegration(key: string): Integration | undefined {
  return BY_KEY.get(key);
}

export function isKnownIntegration(key: string): boolean {
  return BY_KEY.has(key);
}

// The integration a tool belongs to plus the tool itself, or undefined for an unknown
// tool key.
export function getTool(
  toolKey: string,
): { integration: Integration; tool: CustomToolEntry } | undefined {
  return TOOL_INDEX.get(toolKey);
}

// The serializable catalog for a frontend: the credential form is built from each
// integration's credentialSchema, and the tool picker from its tools.
export function integrationDescriptors(): IntegrationDescriptor[] {
  return INTEGRATIONS.map((i) => ({
    key: i.key,
    label: i.label,
    credentialSchema: i.credentialSchema,
    tools: i.tools.map((t) => ({
      key: t.key,
      label: t.label,
      description: t.description,
      scopes: t.scopes,
    })),
  }));
}

// Validates and coerces a submitted credential against a schema: required fields must
// be present, values are coerced to each field's type, and unknown keys are dropped.
// Throws ToolConfigError on a missing required field or an uncoercible value (the API
// maps it to a 400).
export function coerceConfig(fields: ConfigField[], input: unknown): ToolConfig {
  const src = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const out: ToolConfig = {};
  for (const field of fields) {
    const raw = src[field.key];
    const missing = raw === undefined || raw === null || raw === '';
    if (missing) {
      if (field.required) throw new ToolConfigError(`Missing required setting: ${field.label}`);
      continue;
    }
    switch (field.type) {
      case 'number': {
        const n = Number(raw);
        if (Number.isNaN(n)) throw new ToolConfigError(`Setting ${field.label} must be a number`);
        out[field.key] = n;
        break;
      }
      case 'boolean':
        out[field.key] = raw === true || raw === 'true';
        break;
      default:
        out[field.key] = String(raw);
    }
  }
  return out;
}

// Produces the redacted view of a credential: secret fields masked to their last four
// characters, other fields verbatim. Stored in plaintext so a list UI can show what
// is configured without decrypting.
export function redactConfig(fields: ConfigField[], config: ToolConfig): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    if (!(field.key in config)) continue;
    if (field.type === 'secret') {
      const s = String(config[field.key]);
      out[field.key] = s.length <= 4 ? '••••' : `••••${s.slice(-4)}`;
    } else {
      out[field.key] = config[field.key];
    }
  }
  return out;
}
