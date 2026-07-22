import type { Project } from '@/lib/api';
import type { WorkItemsView } from '@/utils/viewTypes';
import type { CommandSection } from '@/utils/commands';
import { useShell } from '@/context/shellContext';
import { useAppCommands } from '@/hooks/useAppCommands';
import { useNavigationCommands } from '@/hooks/useNavigationCommands';
import { useIssueCommands } from '@/features/issue/hooks/useIssueCommands';
import CommandPalette from '@/components/layout/CommandPalette';

// Builds the palette's sections and renders it. It sits inside the Shell's
// context provider (the command hooks read the project and the viewer's
// permissions from it), and owns the confirm dialogs the issue commands open —
// the palette closes when a command runs, so those must outlive it.
//
// Section order: the issue in front of the user first, then the board it came
// from, then the commands and destinations that apply anywhere.
export default function CommandLayer({
  open,
  onOpenChange,
  projects,
  currentProjectKey,
  onBoard,
  view,
  currentIssueId,
  onViewChange,
  onNewIssue,
  onSelectAll,
  onNewProject,
  onSelectProject,
  onOpenIssue,
  onIssueDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: Project[];
  currentProjectKey: string | null;
  onBoard: boolean;
  view: WorkItemsView;
  // The issue the user is looking at: the open detail panel, or the issue page.
  currentIssueId: number | null;
  onViewChange: (view: WorkItemsView) => void;
  onNewIssue: () => void;
  onSelectAll: () => void;
  onNewProject: () => void;
  onSelectProject: (key: string) => void;
  onOpenIssue: (sequenceNumber: number) => void;
  onIssueDeleted: () => void;
}) {
  const { project } = useShell();
  const hasProject = !!project;

  const issue = useIssueCommands(project, currentIssueId, onIssueDeleted);
  const app = useAppCommands({
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
  });
  const navigation = useNavigationCommands(currentProjectKey);

  // Empty sections are dropped here so each hook can return one unconditionally.
  const sections = [issue.section, app.board, app.general, app.projects, navigation].filter(
    (s): s is CommandSection => s != null && s.items.length > 0,
  );

  return (
    <>
      <CommandPalette
        open={open}
        onOpenChange={onOpenChange}
        sections={sections}
        currentProjectKey={currentProjectKey}
        hasProject={hasProject}
        onOpenIssue={onOpenIssue}
      />
      {issue.dialogs}
    </>
  );
}
