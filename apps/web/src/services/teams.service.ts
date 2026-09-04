import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  api,
  nextPageParam,
  type InviteTeamRole,
  type MemberKind,
  type MemberListParams,
  type NotificationSettingsPatch,
  type Team,
  type TeamRole,
} from '@/lib/api';
import { DEFAULT_PAGE_SIZE } from '@/hooks/usePaging';
import { qk } from '@/services/queryKeys';

export function useTeamsQuery() {
  return useQuery({ queryKey: qk.teams, queryFn: () => api.listTeams() });
}

// The team a page is on, out of the list its rail already reads: its name, the
// caller's rank in it and how much it holds. No request of its own.
export function useTeam(teamId: number): Team | null {
  const { data } = useTeamsQuery();
  return data?.find((team) => team.id === teamId) ?? null;
}

// What the caller may do with the resources the team holds. Read on its own because
// resolving it for a plain member costs a query per team, which the list avoids.
export function useTeamQuery(teamId: number) {
  return useQuery({ queryKey: qk.team(teamId), queryFn: () => api.getTeam(teamId) });
}

// One page of a team's members. The search and the window run on the server, so the
// section holds a page rather than every member of the team. The previous page stays
// on screen while the next one loads.
export function useTeamMembersQuery(teamId: number, params: MemberListParams) {
  return useQuery({
    queryKey: qk.teamMembers(teamId, params),
    queryFn: () => api.listTeamMembers(teamId, params),
    placeholderData: keepPreviousData,
  });
}

export function useTeamProjectsQuery(teamId: number) {
  return useQuery({
    queryKey: qk.teamProjects(teamId),
    queryFn: () => api.listTeamProjects(teamId),
  });
}

// One project the team owns. Fetched when the project's row is opened, so a team
// with many projects loads no stats it does not show.
export function useTeamProjectQuery(teamId: number, projectId: number) {
  return useQuery({
    queryKey: qk.teamProject(teamId, projectId),
    queryFn: () => api.getTeamProject(teamId, projectId),
  });
}

// That project's members, a page at a time, read as "show more": the panel appends
// each page to the ones before it. The search and the window run on the server, so
// the panel never loads every member of the project.
export function useTeamProjectMembersQuery(
  teamId: number,
  projectId: number,
  filters: { search?: string; kind: MemberKind },
  pageSize = DEFAULT_PAGE_SIZE,
) {
  return useInfiniteQuery({
    queryKey: qk.teamProjectMembers(teamId, projectId, { ...filters, pageSize }),
    queryFn: ({ pageParam }) =>
      api.listTeamProjectMembers(teamId, projectId, { ...filters, page: pageParam, pageSize }),
    initialPageParam: 1,
    getNextPageParam: nextPageParam,
  });
}

// The team's MCP switch and which of its projects the reach covers, written by an
// owner or a manager.
export function useUpdateTeamMcp(teamId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: {
      enabled?: boolean;
      projects?: { projectId: number; enabled: boolean }[];
    }) => api.updateTeamMcp(teamId, patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.teams });
      void qc.invalidateQueries({ queryKey: qk.teamProjects(teamId) });
      void qc.invalidateQueries({ queryKey: qk.projects });
      // A project's own MCP page reads the state off the project scaffold, which is
      // cached per project key.
      void qc.invalidateQueries({ queryKey: qk.anyProject });
    },
  });
}

export function useCreateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string }) => api.createTeam(input),
    onSuccess: (team) => {
      // Put the team in the cached list right away so the switcher shows it before
      // the refetch lands; it has no projects yet, so nothing else has to load.
      qc.setQueryData<Team[]>(qk.teams, (prev) => (prev ? [...prev, team] : [team]));
      void qc.invalidateQueries({ queryKey: qk.teams });
    },
  });
}

export function useRenameTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { teamId: number; name: string }) =>
      api.renameTeam(input.teamId, { name: input.name }),
    onSuccess: (team) => {
      void qc.invalidateQueries({ queryKey: qk.teams });
      void qc.invalidateQueries({ queryKey: qk.team(team.id) });
      // The switcher groups projects by team name, so the project list carries it too.
      void qc.invalidateQueries({ queryKey: qk.projects });
    },
  });
}

// The rank a member holds in the team, written by an owner or a manager. The whole
// team subtree carries it — its member pages and the leads on its detail — and the
// team list carries how many owners it has.
export function useSetTeamMemberRole(teamId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { userId: string; role: TeamRole }) =>
      api.setTeamMemberRole(teamId, input.userId, input.role),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.team(teamId) });
      void qc.invalidateQueries({ queryKey: qk.teams });
    },
  });
}

// Removes a member from the team, and with them their access to the team's projects.
// The whole team subtree changes — its member list and every project they were in —
// and the team list carries the member count. The project member lists lose them too,
// wherever one is cached.
export function useRemoveTeamMember(teamId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.removeTeamMember(teamId, userId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.team(teamId) });
      void qc.invalidateQueries({ queryKey: qk.teams });
      void qc.invalidateQueries({ queryKey: qk.anyMembers });
    },
  });
}

// Leaving a team takes the caller's projects in it with them, so the project list is
// refreshed along with the teams.
export function useLeaveTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (teamId: number) => api.leaveTeam(teamId),
    onSuccess: (_result, teamId) => {
      qc.setQueryData<Team[]>(qk.teams, (prev) => prev?.filter((t) => t.id !== teamId));
      void qc.invalidateQueries({ queryKey: qk.teams });
      void qc.invalidateQueries({ queryKey: qk.projects });
    },
  });
}

// The invites of a team: the ones into the team itself and the ones into its
// projects. Only an owner or a manager may read them, so pass enabled=false for a
// plain member to keep the request from 403-ing.
export function useTeamInvitesQuery(teamId: number, enabled = true) {
  return useQuery({
    queryKey: qk.teamInvites(teamId),
    queryFn: () => api.listTeamInvites(teamId),
    enabled,
  });
}

// The invite dialog shows the reason under its address field, so this mutation opts
// out of the global error toast.
export function useCreateTeamInvite(teamId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; role: InviteTeamRole }) =>
      api.createTeamInvite(teamId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.teamInvites(teamId) }),
    meta: { suppressErrorToast: true },
  });
}

export function useDeleteTeamInvite(teamId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: number) => api.deleteTeamInvite(teamId, inviteId),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.teamInvites(teamId) }),
  });
}

// The team's notification provider credentials, read and changed by its owner alone,
// so pass null for anyone else to skip the request. A write returns the redacted
// result, which replaces the cache directly.
export function useNotificationSettingsQuery(teamId: number | null) {
  return useQuery({
    queryKey: qk.notificationSettings(teamId ?? 0),
    queryFn: () => api.getNotificationSettings(teamId!),
    enabled: teamId != null,
  });
}

export function useUpdateNotificationSettings(teamId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NotificationSettingsPatch) => api.setNotificationSettings(teamId, input),
    onSuccess: (data) => qc.setQueryData(qk.notificationSettings(teamId), data),
  });
}
