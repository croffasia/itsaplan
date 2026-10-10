import type {
  Integration,
  IntegrationDescriptor,
  CustomToolEntry,
  ConfigField,
  ToolConfig,
} from './types';
import { checkHttpUrl, UrlNotAllowedError } from '@repo/net';
import { ToolConfigError } from './errors';
import { jina } from './tools/jina';
import { firecrawl } from './tools/firecrawl';
import { telegram } from './tools/telegram';
import { threads } from './tools/threads';
import { instagram } from './tools/instagram';
import { notion } from './tools/notion';
import { gitea } from './tools/gitea';

// The registry of tool integrations. Add an integration by creating its folder under
// tools/ and listing it here.
export const INTEGRATIONS: Integration[] = [
  jina,
  firecrawl,
  telegram,
  threads,
  instagram,
  notion,
  gitea,
];

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

// A url field is the address the tool sends its secret to, so it is held to the
// @repo/net rules at save time: https, no private or local host unless
// SSRF_ALLOWED_HOSTS names it. Userinfo, a query and a fragment are refused, and the
// value is stored as origin plus path: an OpenAI-compatible endpoint carries a path
// prefix (`/v1`), and so does a Gitea served under a sub-path. The hostname is not
// resolved here; the client's pinnedFetch does that on every call.
function coerceUrl(field: ConfigField, raw: unknown): string {
  let url: URL;
  try {
    url = checkHttpUrl(String(raw).trim());
  } catch (err) {
    if (!(err instanceof UrlNotAllowedError)) throw err;
    throw new ToolConfigError(`Setting ${field.label} ${err.message.replace(/^url /, '')}`);
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new ToolConfigError(
      `Setting ${field.label} must not carry credentials, a query string, or a fragment`,
    );
  }
  return url.origin + url.pathname.replace(/\/+$/, '');
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
      case 'url':
        out[field.key] = coerceUrl(field, raw);
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
