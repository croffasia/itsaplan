import { LayoutGrid, ListChecks, MessagesSquare, Plus, SquarePlus, Target } from 'lucide-react';
import type { Project } from '@/lib/api/endpoints/projects';
import { useTranslations } from 'next-intl';
import { VIEWS, type WorkItemsView } from '@/utils/viewTypes';
import { byKey } from '@/utils/messageKey';
import { usePermissions } from '@/hooks/usePermissions';
import { useHotkeyFormatter } from '@/context/useHotkeys';
import type { Command, CommandSection } from '@/utils/commands';

// The commands that are not tied to one issue: the work items board controls
// (shown only while the board is open) and the general project commands. The
// handlers come from the Shell, which owns the overlays and the router.
export function useAppCommands({
  hasProject,
  initiativesEnabled,
  onBoard,
  view,
  projects,
  currentProjectKey,
  onViewChange,
  onNewIssue,
  onSelectAll,
  onNewInitiative,
  onNewProject,
  onSelectProject,
  onToggleChat,
}: {
  hasProject: boolean;
  initiativesEnabled: boolean;
  // True on the work items routes, where the layout and selection commands apply.
  onBoard: boolean;
  view: WorkItemsView;
  projects: Project[];
  currentProjectKey: string | null;
  onViewChange: (view: WorkItemsView) => void;
  onNewIssue: () => void;
  onSelectAll: () => void;
  onNewInitiative: () => void;
  onNewProject: () => void;
  onSelectProject: (key: string) => void;
  onToggleChat: () => void;
}): {
  board: CommandSection | null;
  general: CommandSection | null;
  projects: CommandSection | null;
} {
  const t = useTranslations('display');
  const tPalette = useTranslations('palette');
  const layout = byKey(useTranslations('display.layouts'));
  const { can } = usePermissions();
  const hotkey = useHotkeyFormatter();

  const boardItems: Command[] = [];
  if (hasProject && onBoard) {
    for (const { value, icon: Icon, hotkey: id } of VIEWS) {
      boardItems.push({
        id: `board.view.${value}`,
        label: t('layoutCommand', { layout: layout(value) }),
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
        label: tPalette('selectAllIssues'),
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
      label: tPalette('newIssue'),
      icon: <Plus />,
      keywords: 'create add task',
      shortcut: hotkey('issue.new') ?? undefined,
      run: onNewIssue,
    });
  }
  if (hasProject && initiativesEnabled && can('initiatives', 'create')) {
    generalItems.push({
      id: 'general.new-initiative',
      label: tPalette('newInitiative'),
      icon: <Target />,
      keywords: 'create add goal',
      shortcut: hotkey('initiative.new') ?? undefined,
      run: onNewInitiative,
    });
  }
  if (hasProject && can('ai_agents', 'read')) {
    generalItems.push({
      id: 'general.ai-chat',
      label: tPalette('toggleChat'),
      icon: <MessagesSquare />,
      keywords: 'ai agents chat panel',
      shortcut: hotkey('chat.toggle') ?? undefined,
      run: onToggleChat,
    });
  }
  generalItems.push({
    id: 'general.new-project',
    label: tPalette('newProject'),
    icon: <SquarePlus />,
    keywords: 'create add',
    shortcut: hotkey('project.new') ?? undefined,
    run: onNewProject,
  });

  const projectItems: Command[] = projects
    .filter((p) => !p.isHidden)
    .map((p) => ({
      id: `project.switch.${p.key}`,
      label: p.name,
      icon: <LayoutGrid />,
      keywords: `switch project ${p.key}`,
      checked: p.key === currentProjectKey,
      run: () => onSelectProject(p.key),
    }));

  return {
    board:
      boardItems.length > 0 ? { id: 'board', heading: tPalette('board'), items: boardItems } : null,
    general:
      generalItems.length > 0
        ? { id: 'general', heading: tPalette('commands'), items: generalItems }
        : null,
    projects:
      projectItems.length > 0
        ? { id: 'projects', heading: tPalette('switchProject'), items: projectItems }
        : null,
  };
}
