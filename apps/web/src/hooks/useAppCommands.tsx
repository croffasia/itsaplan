import { LayoutGrid, ListChecks, Plus, SquarePlus } from 'lucide-react';
import type { Project } from '@/lib/api';
import { VIEWS, type WorkItemsView } from '@/utils/viewTypes';
import { usePermissions } from '@/hooks/usePermissions';
import { useHotkeyFormatter } from '@/context/useHotkeys';
import type { Command, CommandSection } from '@/utils/commands';

// The commands that are not tied to one issue: the work items board controls
// (shown only while the board is open) and the general project commands. The
// handlers come from the Shell, which owns the overlays and the router.
export function useAppCommands({
  hasProject,
  onBoard,
  view,
  projects,
  currentProjectKey,
  onViewChange,
  onNewIssue,
  onSelectAll,
  onNewProject,
  onSelectProject,
}: {
  hasProject: boolean;
  // True on the work items routes, where the layout and selection commands apply.
  onBoard: boolean;
  view: WorkItemsView;
  projects: Project[];
  currentProjectKey: string | null;
  onViewChange: (view: WorkItemsView) => void;
  onNewIssue: () => void;
  onSelectAll: () => void;
  onNewProject: () => void;
  onSelectProject: (key: string) => void;
}): {
  board: CommandSection | null;
  general: CommandSection | null;
  projects: CommandSection | null;
} {
  const { can } = usePermissions();
  const hotkey = useHotkeyFormatter();

  const boardItems: Command[] = [];
  if (hasProject && onBoard) {
    for (const { value, label, icon: Icon, hotkey: id } of VIEWS) {
      boardItems.push({
        id: `board.view.${value}`,
        label: `${label} layout`,
        icon: <Icon />,
        keywords: 'view layout switch',
        shortcut: hotkey(id) ?? undefined,
        checked: value === view,
        run: () => onViewChange(value),
      });
    }
    if (view === 'kanban') {
      boardItems.push({
        id: 'board.select-all',
        label: 'Select all issues',
        icon: <ListChecks />,
        keywords: 'selection multi',
        shortcut: hotkey('board.select-all') ?? undefined,
        run: onSelectAll,
      });
    }
  }

  const generalItems: Command[] = [];
  if (hasProject && can('work_items', 'create')) {
    generalItems.push({
      id: 'general.new-issue',
      label: 'New issue',
      icon: <Plus />,
      keywords: 'create add task',
      shortcut: hotkey('issue.new') ?? undefined,
      run: onNewIssue,
    });
  }
  generalItems.push({
    id: 'general.new-project',
    label: 'New project',
    icon: <SquarePlus />,
    keywords: 'create add',
    shortcut: hotkey('project.new') ?? undefined,
    run: onNewProject,
  });

  const projectItems: Command[] = projects.map((p, i) => ({
    id: `project.switch.${p.key}`,
    label: p.name,
    icon: <LayoutGrid />,
    keywords: `switch project ${p.key}`,
    checked: p.key === currentProjectKey,
    // The project switch is positional, so the digit is the row's place in the list.
    shortcut: (i < 9 ? hotkey('project.switch')?.replace('1–9', String(i + 1)) : null) ?? undefined,
    run: () => onSelectProject(p.key),
  }));

  return {
    board: boardItems.length > 0 ? { id: 'board', heading: 'Board', items: boardItems } : null,
    general:
      generalItems.length > 0 ? { id: 'general', heading: 'Commands', items: generalItems } : null,
    projects:
      projectItems.length > 0
        ? { id: 'projects', heading: 'Switch project', items: projectItems }
        : null,
  };
}
