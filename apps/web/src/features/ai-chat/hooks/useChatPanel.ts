'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Overlay puts the panel above the content; push makes the content area narrower by
// the width of the panel.
export type ChatPanelMode = 'overlay' | 'push';

export const chatPanelWidthKey = (projectKey: string) => `aiChat:panel:width:${projectKey}`;

const openKey = (projectKey: string) => `aiChat:panel:open:${projectKey}`;
const modeKey = (projectKey: string) => `aiChat:panel:mode:${projectKey}`;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage unavailable (private mode / quota); the panel still applies the change.
  }
}

// Whether the chat panel is open and which mode it is in, kept per project on the
// device. `showByDefault` is the account preference: it opens the panel for a project
// the user has not opened or closed it in yet.
//
// The stored values are read in an effect, not in the state initializer: the
// initializer also runs in the server render, where a client-only value would not
// match the markup.
export function useChatPanel(projectKey: string | null, showByDefault: boolean) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ChatPanelMode>('overlay');
  // The preference arrives after the first render and must not reopen a panel the
  // user closed in the meantime.
  const touched = useRef(false);

  useEffect(() => {
    touched.current = false;
    if (!projectKey) return;
    setMode(read(modeKey(projectKey)) === 'push' ? 'push' : 'overlay');
    setOpen(read(openKey(projectKey)) === 'open');
  }, [projectKey]);

  useEffect(() => {
    if (!projectKey || !showByDefault || touched.current) return;
    if (read(openKey(projectKey)) === null) setOpen(true);
  }, [projectKey, showByDefault]);

  const toggle = useCallback(() => {
    touched.current = true;
    setOpen((prev) => {
      const next = !prev;
      if (projectKey) write(openKey(projectKey), next ? 'open' : 'closed');
      return next;
    });
  }, [projectKey]);

  const toggleMode = useCallback(() => {
    setMode((prev) => {
      const next = prev === 'push' ? 'overlay' : 'push';
      if (projectKey) write(modeKey(projectKey), next);
      return next;
    });
  }, [projectKey]);

  return { open, mode, toggle, toggleMode };
}
