import { useEffect } from 'react';
import type { WorkItemsView } from '@/utils/viewTypes';
import { isTypingTarget, type HotkeyId } from '@/utils/hotkeys';
import { useHotkeyMatch } from '@/context/useHotkeys';

// The layout hotkeys, paired with the view each one opens.
const VIEW_HOTKEYS: [HotkeyId, WorkItemsView][] = [
  ['view.kanban', 'kanban'],
  ['view.table', 'table'],
  ['view.timeline', 'timeline'],
  ['view.calendar', 'calendar'],
];

// The global keyboard layer. Which combination runs what is declared in
// lib/hotkeys; this hook only decides when a binding may fire. A 'global' binding
// (the palette) fires even with an overlay open, while an 'app' one is suppressed
// while the user types or an overlay is open, because its combination is a plain
// key that would land in the text being typed.
export function useKeyboardShortcuts(opts: {
  hasProject: boolean;
  // True on the work items routes, where the filter menu is.
  onBoard: boolean;
  // Whether the side panel has the project's agents to show at all.
  hasAgents: boolean;
  // True while any modal/overlay is open, which suppresses the app bindings.
  overlayOpen: boolean;
  onToggleCommand: () => void;
  onChangeView: (view: WorkItemsView) => void;
  onNewIssue: () => void;
  onNewInitiative: () => void;
  onNewProject: () => void;
  onSettings: () => void;
  onToggleChat: () => void;
  onToggleRuns: () => void;
  onOpenFilter: () => void;
}) {
  const {
    hasProject,
    onBoard,
    hasAgents,
    overlayOpen,
    onToggleCommand,
    onChangeView,
    onNewIssue,
    onNewInitiative,
    onNewProject,
    onSettings,
    onToggleChat,
    onToggleRuns,
    onOpenFilter,
  } = opts;
  const matches = useHotkeyMatch();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (matches(e, 'palette.toggle')) {
        e.preventDefault();
        onToggleCommand();
        return;
      }
      if (isTypingTarget(e.target) || overlayOpen) return;

      if (hasProject) {
        for (const [id, view] of VIEW_HOTKEYS) {
          if (matches(e, id)) {
            e.preventDefault();
            onChangeView(view);
            return;
          }
        }
      }
      if (hasProject && matches(e, 'issue.new')) {
        e.preventDefault();
        onNewIssue();
        return;
      }
      if (hasProject && matches(e, 'initiative.new')) {
        e.preventDefault();
        onNewInitiative();
        return;
      }
      if (matches(e, 'project.new')) {
        e.preventDefault();
        onNewProject();
        return;
      }
      if (hasProject && matches(e, 'project.settings')) {
        e.preventDefault();
        onSettings();
        return;
      }
      if (hasAgents && matches(e, 'chat.toggle')) {
        e.preventDefault();
        onToggleChat();
        return;
      }
      if (hasAgents && matches(e, 'runs.toggle')) {
        e.preventDefault();
        onToggleRuns();
        return;
      }
      // Last, so a key someone already gave another command keeps running that one.
      if (hasProject && onBoard && matches(e, 'filter.open')) {
        e.preventDefault();
        onOpenFilter();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    hasProject,
    onBoard,
    hasAgents,
    overlayOpen,
    matches,
    onToggleCommand,
    onChangeView,
    onNewIssue,
    onNewInitiative,
    onNewProject,
    onSettings,
    onToggleChat,
    onToggleRuns,
    onOpenFilter,
  ]);
}
