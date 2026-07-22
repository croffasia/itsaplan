// The command model behind the palette (⌘K). A command is data: what to show and
// what to run. The palette renders it; the hooks that build the sections decide
// which commands exist for the current place in the app (see
// hooks/useAppCommands, hooks/useNavigationCommands, features/issue/hooks/
// useIssueCommands).
import type { ReactNode } from 'react';

export type Command = {
  // Unique within the palette. Part of the value the palette matches on, so keep
  // it word-like ("issue.archive"), not a random string.
  id: string;
  label: string;
  icon?: ReactNode;
  // Extra terms the search matches, not shown in the row.
  keywords?: string;
  // Display only — the key handling lives in the hotkey layer.
  shortcut?: string;
  // Shows a trailing check, for a command that sets the value already in effect.
  checked?: boolean;
  destructive?: boolean;
  // Opens a second level instead of running (status, priority, assignee, labels).
  submenu?: CommandPage;
  // Keeps the palette open after running, for a command applied several times in
  // one pass (toggling labels).
  keepOpen?: boolean;
  run?: () => void;
};

// A second level of the palette, reached from a command with a submenu.
export type CommandPage = { heading: string; placeholder: string; items: Command[] };

export type CommandSection = { id: string; heading: string; items: Command[] };
