'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  api,
  type InstanceAuthSettingsPatch,
  type InstanceEmailSettingsPatch,
  type InstanceGoogleSettingsPatch,
  type InstanceTelegramSettingsPatch,
  type InstanceUserKind,
  type StorageSettingsPatch,
} from '@/lib/api';
import { qk } from '@/services/queryKeys';

// Data hooks for god mode. Every write returns the new state, which replaces the
// cache entry directly — these are single-row settings, so there is nothing else to
// invalidate. The invite list is a list, so its writes refetch it.

export function useInstanceAuthSettingsQuery() {
  return useQuery({
    queryKey: qk.instanceAuthSettings,
    queryFn: () => api.getInstanceAuthSettings(),
  });
}

export function useUpdateInstanceAuthSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: InstanceAuthSettingsPatch) => api.updateInstanceAuthSettings(patch),
    onSuccess: (data) => qc.setQueryData(qk.instanceAuthSettings, data),
  });
}

export function useInstanceEmailSettingsQuery() {
  return useQuery({
    queryKey: qk.instanceEmailSettings,
    queryFn: () => api.getInstanceEmailSettings(),
  });
}

export function useUpdateInstanceEmailSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: InstanceEmailSettingsPatch) => api.updateInstanceEmailSettings(patch),
    onSuccess: (data) => {
      qc.setQueryData(qk.instanceEmailSettings, data);
      // Turning a provider on unlocks the auth options that need outbound mail.
      void qc.invalidateQueries({ queryKey: qk.instanceAuthSettings });
    },
  });
}

export function useInstanceGoogleSettingsQuery() {
  return useQuery({
    queryKey: qk.instanceGoogleSettings,
    queryFn: () => api.getInstanceGoogleSettings(),
  });
}

export function useUpdateInstanceGoogleSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: InstanceGoogleSettingsPatch) => api.updateInstanceGoogleSettings(patch),
    onSuccess: (data) => qc.setQueryData(qk.instanceGoogleSettings, data),
  });
}

// The instance Telegram bot: the bot users link their accounts through, and the
// default sender for Telegram notifications.
export function useInstanceTelegramSettingsQuery() {
  return useQuery({
    queryKey: qk.instanceTelegramSettings,
    queryFn: () => api.getInstanceTelegramSettings(),
  });
}

export function useUpdateInstanceTelegramSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: InstanceTelegramSettingsPatch) => api.updateInstanceTelegramSettings(patch),
    onSuccess: (data) => qc.setQueryData(qk.instanceTelegramSettings, data),
  });
}

// The upload limits: file sizes, accepted attachment types, and the per-project
// storage quota.
export function useInstanceStorageSettingsQuery() {
  return useQuery({
    queryKey: qk.instanceStorageSettings,
    queryFn: () => api.getInstanceStorageSettings(),
  });
}

export function useUpdateInstanceStorageSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: StorageSettingsPatch) => api.updateInstanceStorageSettings(patch),
    onSuccess: (data) => {
      qc.setQueryData(qk.instanceStorageSettings, data);
      // The upload UI reads the same limits through the open endpoint.
      qc.setQueryData(qk.storageSettings, data);
    },
  });
}

export interface InstanceUserFilters {
  search: string;
  kind: InstanceUserKind;
  limit: number;
  offset: number;
}

// One page of the user directory. The filters are part of the key, and the previous
// page stays on screen while the next one loads so the table does not blank out on
// every keystroke or page step.
export function useInstanceUsersQuery(filters: InstanceUserFilters) {
  return useQuery({
    queryKey: qk.instanceUsers(filters),
    queryFn: () =>
      api.listInstanceUsers({
        search: filters.search || undefined,
        kind: filters.kind,
        limit: filters.limit,
        offset: filters.offset,
      }),
    placeholderData: keepPreviousData,
  });
}

// One account with its project access. The detail panel mounts only while a user is
// selected, so there is no unselected state to fetch for.
export function useInstanceUserQuery(userId: string) {
  return useQuery({
    queryKey: qk.instanceUser(userId),
    queryFn: () => api.getInstanceUser(userId),
  });
}

export function useDeleteInstanceUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { userId: string; withProjects: boolean }) =>
      api.deleteInstanceUser(input.userId, input.withProjects),
    onSuccess: (_data, input) => {
      qc.removeQueries({ queryKey: qk.instanceUser(input.userId) });
      void qc.invalidateQueries({ queryKey: qk.anyInstanceUsers });
      // Deleting the projects the user owned alone changes the sidebar's project
      // list and every project-scoped list the session holds.
      if (input.withProjects) void qc.invalidateQueries({ queryKey: qk.projects });
    },
  });
}

export interface InstanceProjectFilters {
  search: string;
  limit: number;
  offset: number;
}

// One page of the project directory. Like the user directory, the filters are part
// of the key and the previous page stays on screen while the next one loads.
export function useInstanceProjectsQuery(filters: InstanceProjectFilters) {
  return useQuery({
    queryKey: qk.instanceProjects(filters),
    queryFn: () =>
      api.listInstanceProjects({
        search: filters.search || undefined,
        limit: filters.limit,
        offset: filters.offset,
      }),
    placeholderData: keepPreviousData,
  });
}

// One project with its members. Mounted only while a project is selected, like the
// account panel.
export function useInstanceProjectQuery(projectId: number) {
  return useQuery({
    queryKey: qk.instanceProject(projectId),
    queryFn: () => api.getInstanceProject(projectId),
  });
}

export function useVerifyInstanceUserEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.verifyInstanceUserEmail(userId),
    onSuccess: (data) => {
      qc.setQueryData(qk.instanceUser(data.id), data);
      // The list carries emailVerified too, and its key holds the active filters.
      void qc.invalidateQueries({ queryKey: qk.anyInstanceUsers });
    },
  });
}
