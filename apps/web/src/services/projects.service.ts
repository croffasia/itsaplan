import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { removeMember } from '@/lib/api/endpoints/members';
import {
  type CopyProjectIncludeKey,
  createTeamProject,
  copyTeamProject,
  updateTeamProject,
  deleteTeamProject,
} from '@/lib/api/endpoints/teams';
import {
  type Project,
  listProjects,
  getProject,
  getBoardIssues,
  createProject,
  updateProject,
} from '@/lib/api/endpoints/projects';
import { qk } from '@/services/queryKeys';

export function useProjectsQuery() {
  return useQuery({ queryKey: qk.projects, queryFn: () => listProjects() });
}

// The board scaffold (columns, types, labels, custom fields, viewer). The issues
// come from useBoardIssuesQuery; the Shell composes the two.
export function useProjectQuery(projectKey: string | null) {
  return useQuery({
    queryKey: qk.project(projectKey ?? ''),
    queryFn: () => getProject(projectKey!),
    enabled: projectKey != null,
  });
}

// The board's issues plus its change marker, loaded alongside the scaffold.
export function useBoardIssuesQuery(projectKey: string | null) {
  return useQuery({
    queryKey: qk.boardIssues(projectKey ?? ''),
    queryFn: () => getBoardIssues(projectKey!),
    enabled: projectKey != null,
  });
}

// Returns a callback that invalidates a project's detail query. Used by the
// settings service mutations to refresh the project after a structural write.
export function useInvalidateProject(projectKey: string | null) {
  const qc = useQueryClient();
  return () => {
    if (projectKey) {
      void qc.invalidateQueries({ queryKey: qk.project(projectKey) });
      // A structural change (deleted/renamed label, type, column, custom field) can
      // affect how the board's issues render, so refresh the board issues too.
      void qc.invalidateQueries({ queryKey: qk.boardIssues(projectKey) });
    }
    // A structural change (renamed/deleted label, type, assignee, column, or
    // custom field) can change what an open issue detail shows — its values come
    // from the issue query, not the project — so refresh any open issue too. Only
    // the active (open) issue actually refetches.
    void qc.invalidateQueries({ queryKey: qk.anyIssue });
  };
}

// Creates a project, in a given team or — without one — in the team the caller owns.
// `copyFromId` copies that project's structure instead of starting from a preset; the
// source belongs to the same team.
export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      teamId,
      copyFromId,
      input,
    }: {
      teamId?: number;
      copyFromId?: number;
      input: {
        key: string;
        name: string;
        description?: string;
        include?: Partial<Record<CopyProjectIncludeKey, boolean>>;
        preset?: string;
      };
    }) => {
      if (teamId == null) return createProject(input);
      return copyFromId == null
        ? createTeamProject(teamId, input)
        : copyTeamProject(teamId, copyFromId, input);
    },
    onSuccess: (project) => {
      // Add the new project to the cached list immediately so navigating to it
      // (onCreated → setProjectKey) sticks. Otherwise the list has not refetched
      // yet and App's "unknown project key" guard bounces back to the first project.
      qc.setQueryData<Project[]>(qk.projects, (prev) => (prev ? [...prev, project] : [project]));
      void qc.invalidateQueries({ queryKey: qk.projects });
      // The team panel lists the projects of the team, so it gains the new one.
      void qc.invalidateQueries({ queryKey: qk.team(project.teamId) });
      void qc.invalidateQueries({ queryKey: qk.teams });
    },
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectKey,
      patch,
    }: {
      projectKey: string;
      patch: { name?: string; description?: string };
    }) => updateProject(projectKey, patch),
    onSuccess: (updated, { projectKey }) => {
      // Reflect the new name/description in the cached list immediately, then
      // refetch the list and the project detail (its header and switcher read
      // the name) to reconcile.
      // Merge only the edited fields — the update response carries no `role`, so
      // spreading the whole object would wipe the caller's role in the list item.
      qc.setQueryData<Project[]>(qk.projects, (prev) =>
        prev?.map((p) =>
          p.key === projectKey ? { ...p, name: updated.name, description: updated.description } : p,
        ),
      );
      void qc.invalidateQueries({ queryKey: qk.projects });
      void qc.invalidateQueries({ queryKey: qk.project(projectKey) });
    },
  });
}

// Renames a project of a team, or edits its description. Team owners and managers
// may, so the team route carries it rather than the project's own settings.
export function useUpdateTeamProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      teamId,
      projectId,
      patch,
    }: {
      teamId: number;
      projectId: number;
      projectKey: string;
      patch: { name?: string; description?: string };
    }) => updateTeamProject(teamId, projectId, patch),
    onSuccess: (updated, { teamId, projectKey }) => {
      qc.setQueryData<Project[]>(qk.projects, (prev) =>
        prev?.map((p) =>
          p.key === projectKey ? { ...p, name: updated.name, description: updated.description } : p,
        ),
      );
      void qc.invalidateQueries({ queryKey: qk.projects });
      void qc.invalidateQueries({ queryKey: qk.project(projectKey) });
      void qc.invalidateQueries({ queryKey: qk.team(teamId) });
    },
  });
}

// Drops the project from the cached list immediately (so it disappears even
// before the refetch resolves) and discards its now-dead per-project caches so it
// cannot be reopened with stale data. Then refetches the list to reconcile.
function forgetProject(qc: ReturnType<typeof useQueryClient>, projectKey: string) {
  qc.setQueryData<Project[]>(qk.projects, (prev) => prev?.filter((p) => p.key !== projectKey));
  qc.removeQueries({ queryKey: qk.project(projectKey) });
  qc.removeQueries({ queryKey: qk.boardIssues(projectKey) });
  qc.removeQueries({ queryKey: qk.views(projectKey) });
  qc.removeQueries({ queryKey: qk.dashboards(projectKey) });
  qc.removeQueries({ queryKey: qk.analyticsForProject(projectKey) });
  void qc.invalidateQueries({ queryKey: qk.projects });
}

// Leave a project you are a member of (self-removal). The API refuses if you are
// the project's last owner.
export function useLeaveProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectKey, userId }: { projectKey: string; userId: string }) =>
      removeMember(projectKey, userId),
    onSuccess: (_data, { projectKey }) => {
      forgetProject(qc, projectKey);
      // The team panel counts the members of each project it lists and names them.
      void qc.invalidateQueries({ queryKey: qk.anyTeam });
    },
  });
}

// Deletes a project of a team. Only a team owner may, so the team route carries it
// rather than the project's own danger zone.
export function useDeleteTeamProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      teamId,
      projectId,
    }: {
      teamId: number;
      projectId: number;
      projectKey: string;
    }) => deleteTeamProject(teamId, projectId),
    onSuccess: (_data, { teamId, projectKey }) => {
      forgetProject(qc, projectKey);
      void qc.invalidateQueries({ queryKey: qk.team(teamId) });
      void qc.invalidateQueries({ queryKey: qk.teams });
    },
  });
}
