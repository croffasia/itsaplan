import { useEffect } from 'react';
import type { Project } from '@/lib/api';
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
// (the palette, the project switch) fires even with an overlay open, while an
// 'app' one is suppressed while the user types or an overlay is open, because its
// combination is a plain key that would land in the text being typed.
export function useKeyboardShortcuts(opts: {
  hasProject: boolean;
  projects: Project[];
  // True while any modal/overlay is open, which suppresses the app bindings.
  overlayOpen: boolean;
  onToggleCommand: () => void;
  onSelectProject: (key: string) => void;
  onChangeView: (view: WorkItemsView) => void;
  onNewIssue: () => void;
  onNewProject: () => void;
  onSettings: () => void;
}) {
  const {
    hasProject,
    projects,
    overlayOpen,
    onToggleCommand,
    onSelectProject,
    onChangeView,
    onNewIssue,
    onNewProject,
    onSettings,
  } = opts;
  const { matches, digit } = useHotkeyMatch();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (matches(e, 'palette.toggle')) {
        e.preventDefault();
        onToggleCommand();
        return;
      }
      // The project switch is positional: the digit picks the project at that
      // place in the list.
      const position = digit(e, 'project.switch');
      if (position != null) {
        const target = projects[position - 1];
        if (target) {
          e.preventDefault();
          onSelectProject(target.key);
        }
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
      if (matches(e, 'project.new')) {
        e.preventDefault();
        onNewProject();
        return;
      }
      if (hasProject && matches(e, 'project.settings')) {
        e.preventDefault();
        onSettings();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    hasProject,
    projects,
    overlayOpen,
    matches,
    digit,
    onToggleCommand,
    onSelectProject,
    onChangeView,
    onNewIssue,
    onNewProject,
    onSettings,
  ]);
}
