'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAccountPreferences } from '@/services/preferences.service';
import { useHotkeySettingsQuery } from '@/services/hotkeys.service';
import {
  applyOverrides,
  DEFAULT_COMBOS,
  formatCombo,
  matchedDigit,
  matchesCombo,
  type HotkeyCombos,
  type HotkeyId,
} from '@/utils/hotkeys';

// The combinations in effect for the signed-in user. Every listener and every
// shortcut label reads them from here, so a rebound key applies everywhere at once.
// Three layers, each overriding the one before: the built-in bindings, the
// instance-wide ones set in god mode, then the user's own.
const HotkeysCtx = createContext<HotkeyCombos>(DEFAULT_COMBOS);

export function HotkeysProvider({ children }: { children: ReactNode }) {
  const instance = useHotkeySettingsQuery().data;
  const { hotkeys: personal } = useAccountPreferences();

  const combos = useMemo(
    () => applyOverrides(applyOverrides(DEFAULT_COMBOS, instance ?? {}), personal),
    [instance, personal],
  );

  return <HotkeysCtx.Provider value={combos}>{children}</HotkeysCtx.Provider>;
}

export function useHotkeyCombos(): HotkeyCombos {
  return useContext(HotkeysCtx);
}

// Matchers bound to the combinations in effect. `matches` answers whether an event
// is that shortcut; `digit` returns the 1–9 a positional shortcut was pressed with.
export function useHotkeyMatch() {
  const combos = useHotkeyCombos();
  return useMemo(
    () => ({
      matches: (e: KeyboardEvent, id: HotkeyId) => matchesCombo(e, combos[id]),
      digit: (e: KeyboardEvent, id: HotkeyId) => matchedDigit(e, combos[id]),
    }),
    [combos],
  );
}

// True on macOS, so a shortcut is shown as ⌘K rather than Ctrl+K. Resolved after
// mount: the server has no platform to read, and a mismatch would hydrate wrong.
export function useIsMac(): boolean {
  const [isMac, setIsMac] = useState(true);
  useEffect(() => {
    setIsMac(/mac|iphone|ipad/i.test(navigator.userAgent));
  }, []);
  return isMac;
}

// Formats any shortcut for display, for a component that shows several of them.
// Returns null when the id is not bound.
export function useHotkeyFormatter(): (id: HotkeyId) => string | null {
  const combos = useHotkeyCombos();
  const isMac = useIsMac();
  return useMemo(
    () => (id: HotkeyId) => (combos[id] ? formatCombo(combos[id], isMac) : null),
    [combos, isMac],
  );
}

// One shortcut formatted for display, or null when it is not bound.
export function useHotkeyLabel(id: HotkeyId): string | null {
  return useHotkeyFormatter()(id);
}
