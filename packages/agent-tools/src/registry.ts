import type {
  Integration,
  IntegrationDescriptor,
  IntegrationListing,
  CustomToolEntry,
  ConfigField,
  ToolConfig,
  ToolDescriptor,
} from './types';
import { ToolConfigError } from './errors';
import { exa } from './tools/exa';
import { jina } from './tools/jina';
import { firecrawl } from './tools/firecrawl';
import { telegram } from './tools/telegram';
import { slack } from './tools/slack';
import { threads } from './tools/threads';
import { instagram } from './tools/instagram';
import { notion } from './tools/notion';
import { baserow } from './tools/baserow';
import { gitea } from './tools/gitea';
import { github } from './tools/github';
import { gitlab } from './tools/gitlab';
import { pdf } from './tools/pdf';
import { keenable } from './tools/keenable';
import { dataforseo } from './tools/dataforseo';
import { kie } from './tools/kie';

// The core's tool integrations. Add an integration by creating its folder under tools/
// and listing it here.
export const INTEGRATIONS: Integration[] = [
  jina,
  firecrawl,
  telegram,
  slack,
  threads,
  instagram,
  notion,
  baserow,
  gitea,
  github,
  gitlab,
  pdf,
  keenable,
  dataforseo,
  kie,
];

// Listed locked until setExtraIntegrations adds one with the same key.
export const LOCKED_INTEGRATIONS: IntegrationListing[] = [exa];

type ToolIndex = Map<string, { integration: Integration; tool: CustomToolEntry }>;

let integrations = INTEGRATIONS;
let byKey = new Map<string, Integration>();
let toolIndex: ToolIndex = new Map();

// Integration keys and tool keys are unique across all integrations; a collision
// would drop one from the index, so it throws and the previous set stays.
function index(list: Integration[]): void {
  const keys = new Map<string, Integration>();
  const tools: ToolIndex = new Map();
  for (const integration of list) {
    if (keys.has(integration.key)) {
      throw new Error(`Duplicate integration key "${integration.key}".`);
    }
    keys.set(integration.key, integration);
    for (const tool of integration.tools) {
      const clash = tools.get(tool.key);
      if (clash) {
        throw new Error(
          `Duplicate tool key "${tool.key}" in ${integration.key} and ${clash.integration.key}.`,
        );
      }
      tools.set(tool.key, { integration, tool });
    }
  }
  integrations = list;
  byKey = keys;
  toolIndex = tools;
}

index(INTEGRATIONS);

// Integrations an extension of the api adds beside the core's; each call replaces the
// previous ones. A self-hosted instance adds none. A configured tool whose integration
// is removed stays stored, and the runtime skips it.
export function setExtraIntegrations(extra: Integration[] = []): void {
  index([...INTEGRATIONS, ...extra]);
}

export function getIntegration(key: string): Integration | undefined {
  return byKey.get(key);
}

export function isKnownIntegration(key: string): boolean {
  return byKey.has(key);
}

// The integration a tool belongs to plus the tool itself, or undefined for an unknown
// tool key.
export function getTool(
  toolKey: string,
): { integration: Integration; tool: CustomToolEntry } | undefined {
  return toolIndex.get(toolKey);
}

// The listing of a locked integration, for the edition that runs it to build the integration
// on. Throws for a key the core does not list, so that edition fails at start once a listing
// is taken away.
export function lockedListing(key: string): IntegrationListing {
  const listing = LOCKED_INTEGRATIONS.find((l) => l.key === key);
  if (!listing) throw new Error(`No locked integration "${key}".`);
  return listing;
}

// The listings no added integration has taken the key of.
function lockedListings(): IntegrationListing[] {
  return LOCKED_INTEGRATIONS.filter((l) => !byKey.has(l.key));
}

// A tool of a locked integration with its listing, or undefined: what names a configured
// tool kept from a time the integration ran, which no agent gets now.
export function getLockedTool(
  toolKey: string,
): { integration: IntegrationListing; tool: ToolDescriptor } | undefined {
  for (const integration of lockedListings()) {
    const tool = integration.tools.find((t) => t.key === toolKey);
    if (tool) return { integration, tool };
  }
  return undefined;
}

// The serializable catalog for a frontend: the credential form is built from each
// integration's credentialSchema, and the tool picker from its tools. The locked listings
// come last.
export function integrationDescriptors(): IntegrationDescriptor[] {
  const running = integrations.map((i) => ({
    key: i.key,
    label: i.label,
    description: i.description,
    icon: i.icon,
    website: i.website,
    kind: i.kind ?? 'tool',
    credentialSchema: i.credentialSchema,
    credentialOptional: i.credentialOptional,
    tools: i.tools.map((t) => ({
      key: t.key,
      label: t.label,
      description: t.description,
      scopes: t.scopes,
      group: t.group,
    })),
  }));
  const locked = lockedListings().map((l) => ({ ...l, kind: 'tool' as const, locked: true }));
  return [...running, ...locked];
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
