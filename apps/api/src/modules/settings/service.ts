import {
  getSetting,
  setSetting,
  STORAGE_SETTING_KEY,
  getStorageSettings,
  type StorageSettings,
} from '@repo/db';
import { HttpError, intEnv } from '#shared/lib';

// The instance settings kept in app_setting: the upload limits, the keyboard
// shortcuts and the sites that may frame the public pages.

// Instance-wide upload limits (app_setting key 'storage'). getStorageSettings/
// mimeAllowed/MB/StorageSettings live in @repo/db (packages/db/src/domains/storage.ts) —
// the worker checks an imported Plane attachment against the same limits. This module
// keeps only the write side: the limits are set in the database and edited in god mode,
// there is no env var for them.
export async function setStorageSettings(
  patch: Partial<StorageSettings>,
): Promise<StorageSettings> {
  const next = { ...(await getStorageSettings()), ...patch };
  // Types are matched case-insensitively; store them normalized so the settings UI
  // shows what is actually applied.
  next.attachmentMimeTypes = [
    ...new Set(next.attachmentMimeTypes.map((m) => m.trim().toLowerCase()).filter(Boolean)),
  ];
  await setSetting(STORAGE_SETTING_KEY, next);
  return next;
}

// Instance-wide project defaults (app_setting key 'projects'): what a newly
// created project starts with. Only the defaults live here — every one of them
// stays editable per project afterwards, so this decides the starting value and
// nothing else.

const PROJECT_DEFAULTS_SETTING_KEY = 'projects';

export interface ProjectDefaults {
  // Whether a new project starts reachable over MCP. On: an instance driven
  // through MCP does not have to remember the per-project toggle. This is a
  // visibility default, not an access grant — a project still only appears to a
  // member holding a key, exactly as it does today.
  mcpEnabled: boolean;
}

function defaultProjectDefaults(): ProjectDefaults {
  return { mcpEnabled: true };
}

export async function getProjectDefaults(): Promise<ProjectDefaults> {
  const stored = await getSetting<Partial<ProjectDefaults>>(PROJECT_DEFAULTS_SETTING_KEY);
  // Merge over the default so a value written before a field was added stays valid.
  return { ...defaultProjectDefaults(), ...(stored ?? {}) };
}

export async function setProjectDefaults(
  patch: Partial<ProjectDefaults>,
): Promise<ProjectDefaults> {
  const next = { ...(await getProjectDefaults()), ...patch };
  await setSetting(PROJECT_DEFAULTS_SETTING_KEY, next);
  return next;
}

// The instance agent settings (app_setting key 'agents'): what applies to every team's
// agents.

const AGENT_SETTINGS_KEY = 'agents';

export interface AgentSettings {
  // Days the traces of an agent run are kept for; the background sweep deletes older
  // ones (agents/core/runtime/trace-retention.ts). 0 keeps them.
  traceRetentionDays: number;
  // The longest one run may take. AGENT_RUN_TIMEOUT_MS sets the value used until one is saved.
  maxRunSeconds: number;
}

export const MIN_RUN_SECONDS = 10;
export const MAX_RUN_SECONDS = 3600;

function defaultAgentSettings(): AgentSettings {
  return {
    traceRetentionDays: 30,
    maxRunSeconds: Math.min(
      Math.max(Math.round(intEnv('AGENT_RUN_TIMEOUT_MS', 240_000) / 1000), MIN_RUN_SECONDS),
      MAX_RUN_SECONDS,
    ),
  };
}

export async function getAgentSettings(): Promise<AgentSettings> {
  const stored = await getSetting<Partial<AgentSettings>>(AGENT_SETTINGS_KEY);
  return { ...defaultAgentSettings(), ...(stored ?? {}) };
}

export async function setAgentSettings(patch: Partial<AgentSettings>): Promise<AgentSettings> {
  const next = { ...(await getAgentSettings()), ...patch };
  await setSetting(AGENT_SETTINGS_KEY, next);
  return next;
}

// The instance keyboard shortcuts (app_setting key 'hotkeys'): the combination
// each command is bound to for everyone on this instance. Only the bindings
// changed in god mode are stored; the web app fills the rest from its built-in
// defaults, then applies the user's own overrides on top (user_preference.hotkeys).

const HOTKEYS_SETTING_KEY = 'hotkeys';

export type HotkeyCombos = Record<string, string>;

export async function getHotkeySettings(): Promise<HotkeyCombos> {
  return (await getSetting<HotkeyCombos>(HOTKEYS_SETTING_KEY)) ?? {};
}

// Replaces the stored map. The god screen sends the full set of overrides, so an
// unbound command is one left out rather than one written as empty.
export async function setHotkeySettings(combos: HotkeyCombos): Promise<HotkeyCombos> {
  await setSetting(HOTKEYS_SETTING_KEY, combos);
  return combos;
}

// The sites that may show the public pages in a frame (app_setting key 'embedSites'): the
// shared work items and views, and what a build serves under /p. Kept as origins, the way the
// web app writes them into frame-ancestors. Empty, no site may.
const EMBED_SITES_KEY = 'embedSites';

export async function getEmbedSites(): Promise<{ origins: string[] }> {
  return { origins: (await getSetting<string[]>(EMBED_SITES_KEY)) ?? [] };
}

export async function setEmbedSites(origins: string[]): Promise<{ origins: string[] }> {
  const sites = [...new Set(origins.map(siteOrigin))];
  await setSetting(EMBED_SITES_KEY, sites);
  return { origins: sites };
}

// The origins a site may be: a scheme, a host of letters, digits, dots and hyphens (an
// international name is in its ASCII form by then), and a port. Nothing else reaches the
// header, where a `;` or a space would start another directive.
const SITE_ORIGIN = /^https?:\/\/[a-z0-9.-]+(:\d+)?$/;

// A site as the browser names it in a frame check, from what the owner typed.
function siteOrigin(text: string): string {
  const invalid = () =>
    new HttpError(400, `${text} is not a site address, such as https://example.com`);
  let url: URL;
  try {
    url = new URL(text.trim());
  } catch {
    throw invalid();
  }
  const bare = url.pathname === '/' && !url.search && !url.hash && !url.username && !url.password;
  if (!bare || !SITE_ORIGIN.test(url.origin)) throw invalid();
  return url.origin;
}
