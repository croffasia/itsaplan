'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Overlay puts the panel above the content; push makes the content area narrower by
// the width of the panel.
export type SidePanelMode = 'overlay' | 'push';

export type SidePanelTab = 'chat' | 'runs';

export type SidePanelState = ReturnType<typeof useSidePanel>;

// The keys carry the name of the chat, the panel's first tab, so a stored panel stays as
// its owner left it.
export const sidePanelWidthKey = (projectKey: string) => `aiChat:panel:width:${projectKey}`;

const openKey = (projectKey: string) => `aiChat:panel:open:${projectKey}`;
const tabKey = (projectKey: string) => `aiChat:panel:tab:${projectKey}`;
const modeKey = (projectKey: string) => `aiChat:panel:mode:${projectKey}`;
const fullscreenKey = (projectKey: string) => `aiChat:panel:fullscreen:${projectKey}`;

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

// Whether the panel on the end edge is open, on which tab, which mode it is in and whether
// it stands over the whole viewport, kept per project on the device. A closed panel
// keeps its tab. `showChatByDefault` is the account preference: it opens the panel, on the
// chat, for a project the user has not opened or closed it in yet.
//
// The stored values are read in an effect, not in the state initializer: the
// initializer also runs in the server render, where a client-only value would not
// match the markup.
export function useSidePanel(projectKey: string | null, showChatByDefault: boolean) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<SidePanelTab>('chat');
  const [mode, setMode] = useState<SidePanelMode>('overlay');
  const [fullscreen, setFullscreen] = useState(false);
  // The preference arrives after the first render and must not reopen a panel the
  // user closed in the meantime.
  const touched = useRef(false);

  useEffect(() => {
    touched.current = false;
    if (!projectKey) return;
    setMode(read(modeKey(projectKey)) === 'push' ? 'push' : 'overlay');
    setFullscreen(read(fullscreenKey(projectKey)) === 'on');
    setOpen(read(openKey(projectKey)) === 'open');
    setTab(read(tabKey(projectKey)) === 'runs' ? 'runs' : 'chat');
  }, [projectKey]);

  useEffect(() => {
    if (!projectKey || !showChatByDefault || touched.current) return;
    if (read(openKey(projectKey)) === null) setOpen(true);
  }, [projectKey, showChatByDefault]);

  const show = useCallback(
    (next: SidePanelTab) => {
      touched.current = true;
      setOpen(true);
      setTab(next);
      if (!projectKey) return;
      write(openKey(projectKey), 'open');
      write(tabKey(projectKey), next);
    },
    [projectKey],
  );

  const close = useCallback(() => {
    touched.current = true;
    setOpen(false);
    if (projectKey) write(openKey(projectKey), 'closed');
  }, [projectKey]);

  const toggleMode = useCallback(() => {
    setMode((prev) => {
      const next = prev === 'push' ? 'overlay' : 'push';
      if (projectKey) write(modeKey(projectKey), next);
      return next;
    });
  }, [projectKey]);

  const toggleFullscreen = useCallback(() => {
    setFullscreen((prev) => {
      const next = !prev;
      if (projectKey) write(fullscreenKey(projectKey), next ? 'on' : 'off');
      return next;
    });
  }, [projectKey]);

  return { open, tab, mode, fullscreen, show, close, toggleMode, toggleFullscreen };
}
