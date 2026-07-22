import { useEffect, useRef, useState } from 'react';
import type { NewIssueDefaults } from '@/utils/project';

// The project-level overlays: the new-project modal, the command palette, the
// new-issue modal and the issue detail panel. Grouped here so the Shell tracks
// one object instead of four flags, and so the keyboard shortcut layer can ask
// whether any overlay is open through `anyOpen`. Project settings are their own
// pages, not an overlay.
// `showChatByDefault` is the account preference: it shows the floating chat button
// from the start, with the chat window collapsed.
export function useOverlays(showChatByDefault: boolean) {
  const [showNewProject, setShowNewProject] = useState(false);
  const [showCommand, setShowCommand] = useState(false);
  // Initial field values for a new issue (null = the new-issue modal is closed).
  const [newIssueDefaults, setNewIssueDefaults] = useState<NewIssueDefaults | null>(null);
  // Which issue the detail panel shows (null = the panel is closed).
  const [openIssueId, setOpenIssueId] = useState<number | null>(null);
  // The floating AI chat. `chatEnabled` is the header toggle (shows the floating
  // button); `chatOpen` is whether the chat window is expanded. Kept out of
  // `anyOpen` so the chat does not suppress the keyboard shortcuts.
  const [chatEnabled, setChatEnabled] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  // The preference arrives after the first render, so it is applied in an effect,
  // and only once — a manual toggle afterwards stays as the user left it.
  const defaultApplied = useRef(false);
  useEffect(() => {
    if (defaultApplied.current || !showChatByDefault) return;
    defaultApplied.current = true;
    setChatEnabled(true);
  }, [showChatByDefault]);

  // Turning the chat on opens the window immediately; turning it off hides both
  // the button and the window.
  const toggleChat = () => {
    const next = !chatEnabled;
    setChatEnabled(next);
    setChatOpen(next);
  };

  const anyOpen = showNewProject || showCommand || newIssueDefaults != null || openIssueId != null;

  return {
    showNewProject,
    setShowNewProject,
    showCommand,
    setShowCommand,
    newIssueDefaults,
    setNewIssueDefaults,
    openIssueId,
    setOpenIssueId,
    chatEnabled,
    chatOpen,
    setChatOpen,
    toggleChat,
    anyOpen,
  };
}
