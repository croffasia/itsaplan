import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  useBoardIssuesQuery,
  useProjectQuery,
  useProjectsQuery,
} from '@/services/projects.service';
import { useViewsQuery } from '@/services/views.service';
import { usePlannedCyclesQuery } from '@/services/cycles.service';
import { ApiError } from '@/lib/api';
import { applyFilters } from '@/utils/filters';
import { withoutShownSubtasks } from '@/utils/subtasks';
import { viewPath } from '@/utils/paths';
import { useViewEditor } from '@/hooks/useViewEditor';

function errorMessage(error: unknown): string | null {
  if (!error) return null;
  return error instanceof Error ? error.message : String(error);
}

// The project state behind the Shell: the project list, the composed project, the
// saved views and the view editor, plus the load/error flags the Shell renders
// from. Kept out of the Shell so it stays a composition of chrome and overlays.
export function useShellProject(projectKey: string | null, activeViewId: number | null) {
  const router = useRouter();

  const projectsQuery = useProjectsQuery();
  const projects = useMemo(() => projectsQuery.data ?? [], [projectsQuery.data]);

  // The board loads as two queries: the scaffold (columns/types/labels/fields/
  // viewer) and the issues + change marker. They are composed into one project
  // object here so every child reads project.issues / project.rev as before.
  const projectQuery = useProjectQuery(projectKey);
  const boardIssuesQuery = useBoardIssuesQuery(projectKey);
  const scaffold = projectQuery.data ?? null;
  // The planned cycles join the composite so grouping by cycle can lay out a lane
  // per cycle a board plans into, not only per cycle an issue is already in. The
  // whole list is not loaded: it grows with every finished cycle, and a finished
  // one only needs a lane while its issues name it. Fetched while the section is
  // on and the viewer may read it.
  const canReadCycles =
    scaffold?.viewer.role === 'owner' || scaffold?.permissions.cycles?.read === true;
  const cyclesQuery = usePlannedCyclesQuery(
    scaffold?.project.cyclesEnabled && canReadCycles ? projectKey : null,
  );
  const project = useMemo(
    () =>
      scaffold
        ? {
            ...scaffold,
            issues: boardIssuesQuery.data?.issues ?? [],
            rev: boardIssuesQuery.data?.rev ?? '',
            plannedCycles: cyclesQuery.data ?? [],
          }
        : null,
    [scaffold, boardIssuesQuery.data, cyclesQuery.data],
  );

  const viewsQuery = useViewsQuery(projectKey);
  const views = useMemo(() => viewsQuery.data ?? [], [viewsQuery.data]);

  // Saved-views, layout, display and filter editing for the current project. The
  // active view is the route param; selecting a view navigates.
  const editor = useViewEditor(
    projectKey,
    views,
    activeViewId,
    (id) => projectKey && router.push(viewPath(projectKey, id)),
  );

  // The project with the active filters applied to its issues: the active view's
  // own conditions plus any ad-hoc ones. Subtasks are then left out of every
  // layout's own rows — they are rendered under their parent instead — while the
  // unfiltered project keeps them for those sub-rows to read — unless the display
  // asks for them separately, or the Subtasks section is off and nothing renders
  // the hierarchy.
  const separateSubtasks = editor.settings.separateSubtasks;
  const filteredProject = useMemo(() => {
    if (!project) return null;
    const filtered = applyFilters(project.issues, editor.effectiveFilters, project);
    const hideSubtaskRows = project.project.subtasksEnabled && !separateSubtasks;
    return { ...project, issues: hideSubtaskRows ? withoutShownSubtasks(filtered) : filtered };
  }, [project, editor.effectiveFilters, separateSubtasks]);

  // Every custom field of the project comes with the board payload; consumers
  // filter by issueTypeId locally.
  const customFields = useMemo(() => project?.customFields ?? [], [project]);

  // The Shell provides the permission context, so the viewer is read directly
  // rather than through usePermissions. Gates the create-issue keyboard shortcut;
  // the header and command palette gate their own controls via usePermissions.
  const viewer = project?.viewer ?? null;
  const canCreateIssue =
    !!viewer && (viewer.role === 'owner' || project?.permissions.work_items?.create === true);

  const error =
    projectsQuery.error ?? projectQuery.error ?? boardIssuesQuery.error ?? viewsQuery.error;

  return {
    projects,
    projectsLoaded: projectsQuery.data != null,
    project,
    filteredProject,
    views,
    editor,
    customFields,
    canCreateIssue,
    errorMsg: errorMessage(error),
    // A 403 means the session is valid but the user is not a member of this
    // project. Shown as an access message instead of the generic error banner
    // (and never as a login bounce — the middleware owns the no-session case).
    forbidden: error instanceof ApiError && error.status === 403,
  };
}
