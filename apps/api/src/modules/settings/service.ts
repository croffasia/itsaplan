import { getSetting, setSetting } from '@repo/db';

// The instance settings kept in app_setting: the upload limits and the keyboard
// shortcuts.

// Instance-wide upload limits (app_setting key 'storage'). They apply to every
// upload path in the api and are read by the web app before a file is picked, so
// the limit is visible in the UI instead of only surfacing as a 413.
//
// The row is seeded by migration 0046, so the limits are set in the database and
// edited in god mode — there is no env var for them. defaultStorageSettings() is
// the fallback for a missing row and the source of the seeded values; keep the two
// in sync.

const STORAGE_SETTING_KEY = 'storage';

export const MB = 1024 * 1024;

export interface StorageSettings {
  // Upper bound on a single attachment. The multipart body is buffered in memory,
  // so this also bounds per-upload memory.
  maxAttachmentMb: number;
  // Upper bound on a single avatar image.
  maxAvatarMb: number;
  // Accepted attachment content types. An entry is a full type ('application/pdf')
  // or a wildcard ('image/*'). An empty list accepts any type.
  attachmentMimeTypes: string[];
  // Total stored attachment bytes allowed per project, in MB. 0 means unlimited.
  projectQuotaMb: number;
}

// Images, video, PDF, office documents and plain text formats. Executables,
// archives and anything else are refused until an admin adds them.
const DEFAULT_ATTACHMENT_MIME_TYPES = [
  'image/*',
  'video/*',
  'application/pdf',
  'text/plain',
  'text/csv',
  'text/markdown',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.presentation',
];

function defaultStorageSettings(): StorageSettings {
  return {
    maxAttachmentMb: 25,
    maxAvatarMb: 5,
    attachmentMimeTypes: DEFAULT_ATTACHMENT_MIME_TYPES,
    projectQuotaMb: 50 * 1024,
  };
}

export async function getStorageSettings(): Promise<StorageSettings> {
  const stored = await getSetting<Partial<StorageSettings>>(STORAGE_SETTING_KEY);
  // Merge over the default so a value written before a field was added stays valid.
  return { ...defaultStorageSettings(), ...(stored ?? {}) };
}

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

// Whether a content type passes the allowlist. An empty list accepts anything.
// Entries are already normalized by setStorageSettings.
export function mimeAllowed(contentType: string, allowed: string[]): boolean {
  if (allowed.length === 0) return true;
  const ct = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
  return allowed.some((pattern) =>
    pattern.endsWith('/*') ? ct.startsWith(pattern.slice(0, -1)) : ct === pattern,
  );
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
