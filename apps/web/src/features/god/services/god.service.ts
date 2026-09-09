'use client';

import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type { AgentSettings } from '@/lib/api/endpoints/god';
import type { StorageSettingsPatch } from '@/lib/api/endpoints/settings';
import type { ProjectDefaults } from '@/lib/api/endpoints/projects';
import { nextPageParam, type PageParams } from '@/lib/api/core/paging';
import { DEFAULT_PAGE_SIZE } from '@/hooks/usePaging';
import {
  type InstanceAuthSettingsPatch,
  type InstanceEmailSettingsPatch,
  type InstanceGoogleSettingsPatch,
  type InstanceOidcSettingsPatch,
  type InstanceTelegramSettingsPatch,
  type InstanceUserKind,
  getInstanceAuthSettings,
  updateInstanceAuthSettings,
  getInstanceEmailSettings,
  updateInstanceEmailSettings,
  testInstanceEmailSettings,
  getInstanceGoogleSettings,
  updateInstanceGoogleSettings,
  getInstanceOidcSettings,
  updateInstanceOidcSettings,
  getInstanceTelegramSettings,
  updateInstanceTelegramSettings,
  getInstanceProjectDefaults,
  updateInstanceProjectDefaults,
  getInstanceAgentSettings,
  updateInstanceAgentSettings,
  getInstanceStorageSettings,
  updateInstanceStorageSettings,
  listInstanceUsers,
  getInstanceUser,
  deleteInstanceUser,
  listInstanceProjects,
  listInstanceProjectOptions,
  getInstanceProject,
  listInstanceTeams,
  getInstanceTeam,
  listInstanceTeamProjects,
  listInstanceTeamMembers,
  verifyInstanceUserEmail,
} from '@/lib/api/endpoints/god';
import {
  getInstanceScimSettings,
  updateInstanceScimSettings,
  createInstanceScimToken,
  listInstanceScimGroups,
  setInstanceScimGroupMappings,
} from '@/lib/api/endpoints/scim';
import { qk } from '@/services/queryKeys';

// Data hooks for god mode. Every write returns the new state, which replaces the
// cache entry directly — these are single-row settings, so there is nothing else to
// invalidate. The invite list is a list, so its writes refetch it.

// Configuring a sign-in provider decides whether password sign-in may be turned off,
// and changes what the sign-in screen offers.
function invalidateSignInMethods(qc: ReturnType<typeof useQueryClient>): void {
  void qc.invalidateQueries({ queryKey: qk.instanceAuthSettings });
  void qc.invalidateQueries({ queryKey: qk.authConfig });
}

export function useInstanceAuthSettingsQuery() {
  return useQuery({
    queryKey: qk.instanceAuthSettings,
    queryFn: () => getInstanceAuthSettings(),
  });
}

export function useUpdateInstanceAuthSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: InstanceAuthSettingsPatch) => updateInstanceAuthSettings(patch),
    onSuccess: (data) => qc.setQueryData(qk.instanceAuthSettings, data),
  });
}

export function useInstanceEmailSettingsQuery() {
  return useQuery({
    queryKey: qk.instanceEmailSettings,
    queryFn: () => getInstanceEmailSettings(),
  });
}

export function useUpdateInstanceEmailSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: InstanceEmailSettingsPatch) => updateInstanceEmailSettings(patch),
    onSuccess: (data) => {
      qc.setQueryData(qk.instanceEmailSettings, data);
      // Turning a provider on unlocks the auth options that need outbound mail.
      void qc.invalidateQueries({ queryKey: qk.instanceAuthSettings });
    },
  });
}

export function useTestInstanceEmailSettings() {
  return useMutation({
    mutationFn: (patch: InstanceEmailSettingsPatch) => testInstanceEmailSettings(patch),
  });
}

export function useInstanceGoogleSettingsQuery() {
  return useQuery({
    queryKey: qk.instanceGoogleSettings,
    queryFn: () => getInstanceGoogleSettings(),
  });
}

export function useUpdateInstanceGoogleSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: InstanceGoogleSettingsPatch) => updateInstanceGoogleSettings(patch),
    onSuccess: (data) => {
      qc.setQueryData(qk.instanceGoogleSettings, data);
      invalidateSignInMethods(qc);
    },
  });
}

// The instance's generic OIDC provider, the second way in besides Google.
export function useInstanceOidcSettingsQuery() {
  return useQuery({
    queryKey: qk.instanceOidcSettings,
    queryFn: () => getInstanceOidcSettings(),
  });
}

export function useUpdateInstanceOidcSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: InstanceOidcSettingsPatch) => updateInstanceOidcSettings(patch),
    onSuccess: (data) => {
      qc.setQueryData(qk.instanceOidcSettings, data);
      invalidateSignInMethods(qc);
    },
  });
}

// SCIM provisioning: the token an identity provider authenticates with, and what the
// groups it pushes grant.
export function useInstanceScimSettingsQuery() {
  return useQuery({
    queryKey: qk.instanceScimSettings,
    queryFn: () => getInstanceScimSettings(),
  });
}

export function useUpdateInstanceScimSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: { enabled: boolean }) => updateInstanceScimSettings(patch),
    onSuccess: (data) => qc.setQueryData(qk.instanceScimSettings, data),
  });
}

export function useCreateInstanceScimToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => createInstanceScimToken(),
    // The response is the token itself, not the settings, so the redacted view has
    // to be refetched for its new prefix.
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.instanceScimSettings }),
  });
}

export function useInstanceScimGroupsQuery() {
  return useQuery({
    queryKey: qk.instanceScimGroups,
    queryFn: () => listInstanceScimGroups(),
  });
}

export function useSetInstanceScimGroupMappings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      groupId: string;
      mappings: { projectId: number; role: 'owner' | 'member'; roleId: number | null }[];
    }) => setInstanceScimGroupMappings(input.groupId, input.mappings),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.instanceScimGroups }),
  });
}

// The instance Telegram bot: the bot users link their accounts through, and the
// default sender for Telegram notifications.
export function useInstanceTelegramSettingsQuery() {
  return useQuery({
    queryKey: qk.instanceTelegramSettings,
    queryFn: () => getInstanceTelegramSettings(),
  });
}

export function useUpdateInstanceTelegramSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: InstanceTelegramSettingsPatch) => updateInstanceTelegramSettings(patch),
    onSuccess: (data) => qc.setQueryData(qk.instanceTelegramSettings, data),
  });
}

// What a new project starts with on this instance. Projects that already exist are
// untouched by a change here.
export function useInstanceProjectDefaultsQuery() {
  return useQuery({
    queryKey: qk.instanceProjectDefaults,
    queryFn: () => getInstanceProjectDefaults(),
  });
}

export function useUpdateInstanceProjectDefaults() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ProjectDefaults) => updateInstanceProjectDefaults(body),
    onSuccess: (data) => qc.setQueryData(qk.instanceProjectDefaults, data),
  });
}

// What applies to every team's agents: how long their run traces are kept.
export function useInstanceAgentSettingsQuery() {
  return useQuery({
    queryKey: qk.instanceAgentSettings,
    queryFn: () => getInstanceAgentSettings(),
  });
}

export function useUpdateInstanceAgentSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AgentSettings) => updateInstanceAgentSettings(body),
    onSuccess: (data) => qc.setQueryData(qk.instanceAgentSettings, data),
  });
}

// The upload limits: file sizes, accepted attachment types, and the per-project
// storage quota.
export function useInstanceStorageSettingsQuery() {
  return useQuery({
    queryKey: qk.instanceStorageSettings,
    queryFn: () => getInstanceStorageSettings(),
  });
}

export function useUpdateInstanceStorageSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: StorageSettingsPatch) => updateInstanceStorageSettings(patch),
    onSuccess: (data) => {
      qc.setQueryData(qk.instanceStorageSettings, data);
      // The upload UI reads the same limits through the open endpoint.
      qc.setQueryData(qk.storageSettings, data);
    },
  });
}

export interface InstanceUserFilters extends PageParams {
  search: string;
  kind: InstanceUserKind;
}

// One page of the user directory. The filters are part of the key, and the previous
// page stays on screen while the next one loads so the table does not blank out on
// every keystroke or page step.
export function useInstanceUsersQuery(filters: InstanceUserFilters) {
  return useQuery({
    queryKey: qk.instanceUsers(filters),
    queryFn: () => listInstanceUsers({ ...filters, search: filters.search || undefined }),
    placeholderData: keepPreviousData,
  });
}

// One account with its project access. The detail panel mounts only while a user is
// selected, so there is no unselected state to fetch for.
export function useInstanceUserQuery(userId: string) {
  return useQuery({
    queryKey: qk.instanceUser(userId),
    queryFn: () => getInstanceUser(userId),
  });
}

export function useDeleteInstanceUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { userId: string; withProjects: boolean }) =>
      deleteInstanceUser(input.userId, input.withProjects),
    onSuccess: (_data, input) => {
      qc.removeQueries({ queryKey: qk.instanceUser(input.userId) });
      void qc.invalidateQueries({ queryKey: qk.anyInstanceUsers });
      // Deleting the projects the user owned alone changes the sidebar's project
      // list and every project-scoped list the session holds.
      if (input.withProjects) void qc.invalidateQueries({ queryKey: qk.projects });
    },
  });
}

export interface InstanceProjectFilters extends PageParams {
  search: string;
}

// One page of the project directory. Like the user directory, the filters are part
// of the key and the previous page stays on screen while the next one loads.
export function useInstanceProjectsQuery(filters: InstanceProjectFilters) {
  return useQuery({
    queryKey: qk.instanceProjects(filters),
    queryFn: () => listInstanceProjects({ ...filters, search: filters.search || undefined }),
    placeholderData: keepPreviousData,
  });
}

// Every project on the instance, for the SCIM mapping picker. Changes rarely, so it
// is cached for the session.
export function useInstanceProjectOptionsQuery() {
  return useQuery({
    queryKey: qk.instanceProjectOptions,
    queryFn: () => listInstanceProjectOptions(),
    staleTime: Infinity,
  });
}

// One project with its members. Mounted only while a project is selected, like the
// account panel.
export function useInstanceProjectQuery(projectId: number) {
  return useQuery({
    queryKey: qk.instanceProject(projectId),
    queryFn: () => getInstanceProject(projectId),
  });
}

export function useVerifyInstanceUserEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => verifyInstanceUserEmail(userId),
    onSuccess: (data) => {
      qc.setQueryData(qk.instanceUser(data.id), data);
      // The list carries emailVerified too, and its key holds the active filters.
      void qc.invalidateQueries({ queryKey: qk.anyInstanceUsers });
    },
  });
}

export interface InstanceTeamFilters extends PageParams {
  search: string;
}

// One page of the team directory. Like the project directory, the filters are part
// of the key and the previous page stays on screen while the next one loads.
export function useInstanceTeamsQuery(filters: InstanceTeamFilters) {
  return useQuery({
    queryKey: qk.instanceTeams(filters),
    queryFn: () => listInstanceTeams({ ...filters, search: filters.search || undefined }),
    placeholderData: keepPreviousData,
  });
}

// One team with its counts. Mounted only while a team is selected.
export function useInstanceTeamQuery(teamId: number) {
  return useQuery({
    queryKey: qk.instanceTeam(teamId),
    queryFn: () => getInstanceTeam(teamId),
  });
}

// The projects a team owns and the people in it, each a page at a time. The search
// runs on the server, so it reaches what the loaded pages do not hold.
export function useInstanceTeamProjectsQuery(teamId: number, search: string | undefined) {
  return useInfiniteQuery({
    queryKey: qk.instanceTeamProjects(teamId, { search }),
    queryFn: ({ pageParam }) =>
      listInstanceTeamProjects(teamId, { search, page: pageParam, pageSize: DEFAULT_PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: nextPageParam,
  });
}

export function useInstanceTeamMembersQuery(teamId: number, search: string | undefined) {
  return useInfiniteQuery({
    queryKey: qk.instanceTeamMembers(teamId, { search }),
    queryFn: ({ pageParam }) =>
      listInstanceTeamMembers(teamId, { search, page: pageParam, pageSize: DEFAULT_PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: nextPageParam,
  });
}
