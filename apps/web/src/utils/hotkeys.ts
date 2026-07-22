// The app's keyboard shortcuts, in one place. Every binding that runs a command
// is declared here; the listeners (the global layer, the board selection) ask this
// module whether an event matches an id instead of comparing keys themselves, so a
// combination is defined once and can be overridden per instance and per user.
//
// Not listed: Escape to close a surface and the Enter/arrow handling inside inputs,
// menus and dialogs. Those are conventions of the control they belong to, not
// commands, and they are never rebound.

export type HotkeyId =
  | 'palette.toggle'
  | 'project.switch'
  | 'sidebar.toggle'
  | 'view.kanban'
  | 'view.table'
  | 'view.timeline'
  | 'view.calendar'
  | 'issue.new'
  | 'project.new'
  | 'project.settings'
  | 'board.select-all';

// `scope` decides when the binding is live. A 'global' one fires even while the
// user types or an overlay is open; an 'app' one is suppressed then, because its
// combination is a plain key that would land in the text being typed.
// `fixed` marks a binding that cannot be rebound: it is positional (⌘1–9) rather
// than a single combination.
export type HotkeyDef = {
  id: HotkeyId;
  label: string;
  group: string;
  combo: string;
  scope: 'global' | 'app';
  fixed?: true;
};

// A combo is written as lowercase tokens joined by '+': the modifiers 'mod'
// (⌘ on macOS, Ctrl elsewhere), 'shift' and 'alt', then the key. The key 'digit'
// stands for the digits 1–9 and is only used by the positional project switch.
export const HOTKEYS: HotkeyDef[] = [
  {
    id: 'palette.toggle',
    label: 'Open the command palette',
    group: 'General',
    combo: 'mod+k',
    scope: 'global',
  },
  {
    id: 'project.switch',
    label: 'Switch to project 1–9',
    group: 'General',
    combo: 'mod+digit',
    scope: 'global',
    fixed: true,
  },
  // Bound by the sidebar primitive (components/ui/sidebar), which carries its own
  // listener. Listed here so the shortcut is documented in one place; it is not
  // rebindable for that reason.
  {
    id: 'sidebar.toggle',
    label: 'Show or hide the sidebar',
    group: 'General',
    combo: 'mod+b',
    scope: 'global',
    fixed: true,
  },
  { id: 'issue.new', label: 'New issue', group: 'General', combo: 'n', scope: 'app' },
  { id: 'project.new', label: 'New project', group: 'General', combo: 'b', scope: 'app' },
  {
    id: 'project.settings',
    label: 'Open project settings',
    group: 'General',
    combo: 's',
    scope: 'app',
  },
  { id: 'view.kanban', label: 'Board layout', group: 'Work items', combo: '1', scope: 'app' },
  { id: 'view.table', label: 'Table layout', group: 'Work items', combo: '2', scope: 'app' },
  { id: 'view.timeline', label: 'Timeline layout', group: 'Work items', combo: '3', scope: 'app' },
  { id: 'view.calendar', label: 'Calendar layout', group: 'Work items', combo: '4', scope: 'app' },
  {
    id: 'board.select-all',
    label: 'Select all issues on the board',
    group: 'Work items',
    combo: 'mod+a',
    scope: 'app',
  },
];

export type HotkeyCombos = Record<HotkeyId, string>;

export const DEFAULT_COMBOS = Object.fromEntries(
  HOTKEYS.map((h) => [h.id, h.combo]),
) as HotkeyCombos;

// Lays a set of overrides over a resolved map. Ids the app does not know are
// ignored, so a stale override left by a removed command cannot shadow a current
// binding.
export function applyOverrides(
  base: HotkeyCombos,
  overrides: Record<string, string>,
): HotkeyCombos {
  const next = { ...base };
  for (const [id, combo] of Object.entries(overrides)) {
    if (id in next) next[id as HotkeyId] = combo;
  }
  return next;
}

type ParsedCombo = { mod: boolean; shift: boolean; alt: boolean; key: string };

function parseCombo(combo: string): ParsedCombo {
  const parts = combo.toLowerCase().split('+');
  return {
    mod: parts.includes('mod'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt'),
    key: parts[parts.length - 1] ?? '',
  };
}

// ⌘ and Ctrl are treated as the same modifier, so a combination works on macOS and
// on Windows/Linux without a per-platform table.
type KeyEventLike = {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
};

function matchesParsed(e: KeyEventLike, c: ParsedCombo): boolean {
  const mod = e.metaKey || e.ctrlKey;
  return mod === c.mod && e.shiftKey === c.shift && e.altKey === c.alt;
}

export function matchesCombo(e: KeyEventLike, combo: string): boolean {
  const c = parseCombo(combo);
  return matchesParsed(e, c) && e.key.toLowerCase() === c.key;
}

// The digit 1–9 a positional combination was pressed with, or null. Used by the
// project switch, which has no fixed key.
export function matchedDigit(e: KeyEventLike, combo: string): number | null {
  const c = parseCombo(combo);
  if (c.key !== 'digit' || !matchesParsed(e, c)) return null;
  return /^[1-9]$/.test(e.key) ? Number(e.key) : null;
}

// The combination a key press stands for, or null when the press cannot be bound:
// a modifier on its own, or a key that is not a letter or a digit. Used by the
// settings screens to record a new binding.
export function comboFromEvent(e: KeyEventLike): string | null {
  const key = e.key.toLowerCase();
  if (!/^[a-z0-9]$/.test(key)) return null;
  const parts: string[] = [];
  if (e.metaKey || e.ctrlKey) parts.push('mod');
  if (e.shiftKey) parts.push('shift');
  if (e.altKey) parts.push('alt');
  parts.push(key);
  return parts.join('+');
}

// True when the event target is a text field, where a plain-key shortcut would
// swallow the character being typed.
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return (
    !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName ?? ''))
  );
}

// The combination as shown in the UI: ⌘K on macOS, Ctrl+K elsewhere.
export function formatCombo(combo: string, isMac: boolean): string {
  const c = parseCombo(combo);
  const out: string[] = [];
  if (c.mod) out.push(isMac ? '⌘' : 'Ctrl');
  if (c.shift) out.push(isMac ? '⇧' : 'Shift');
  if (c.alt) out.push(isMac ? '⌥' : 'Alt');
  out.push(c.key === 'digit' ? '1–9' : c.key.toUpperCase());
  return isMac ? out.join('') : out.join('+');
}
