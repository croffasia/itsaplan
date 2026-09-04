// React Query hooks for everything the settings feature reads and writes: the
// project's structural entities (columns, issue types, labels and label groups,
// custom fields, issue templates), the workflow configuration, the project notification delivery
// settings, and the session member's own notification preferences. Structural
// writes go through useProjectMutation and invalidate the project detail; the
// settings and notification writes return the stored result and put it straight
// into the cache. This module wraps the low-level fetch client (api.ts).

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  api,
  type AutoArchiveSettings,
  type EstimateSettings,
  type NotificationSettingsPatch,
  type NotificationPreferences,
  type ProjectFeatures,
  type SubtaskAutomationSettings,
} from '@/lib/api';
import { useInvalidateProject } from '@/services/projects.service';
import { qk } from '@/services/queryKeys';

// A mutation whose success invalidates the project detail (and dependent lists).
// Shared by every settings write below.
function useProjectMutation<TArgs>(
  projectKey: string,
  mutationFn: (args: TArgs) => Promise<unknown>,
) {
  const invalidate = useInvalidateProject(projectKey);
  return useMutation({ mutationFn, onSuccess: () => invalidate() });
}

export function useCreateColumn(projectKey: string) {
  return useProjectMutation(projectKey, (input: Parameters<typeof api.createColumn>[1]) =>
    api.createColumn(projectKey, input),
  );
}

export function useUpdateColumn(projectKey: string) {
  return useProjectMutation(
    projectKey,
    ({ id, patch }: { id: number; patch: Parameters<typeof api.updateColumn>[2] }) =>
      api.updateColumn(projectKey, id, patch),
  );
}

export function useReorderColumns(projectKey: string) {
  return useProjectMutation(projectKey, (orderedIds: number[]) =>
    api.reorderColumns(projectKey, orderedIds),
  );
}

export function useDeleteColumn(projectKey: string) {
  return useProjectMutation(
    projectKey,
    ({ id, body }: { id: number; body: Parameters<typeof api.deleteColumn>[2] }) =>
      api.deleteColumn(projectKey, id, body),
  );
}

export function useCreateIssueType(projectKey: string) {
  return useProjectMutation(projectKey, (input: Parameters<typeof api.createIssueType>[1]) =>
    api.createIssueType(projectKey, input),
  );
}

export function useUpdateIssueType(projectKey: string) {
  return useProjectMutation(
    projectKey,
    ({ id, patch }: { id: number; patch: Parameters<typeof api.updateIssueType>[2] }) =>
      api.updateIssueType(projectKey, id, patch),
  );
}

export function useDeleteIssueType(projectKey: string) {
  return useProjectMutation(projectKey, (id: number) => api.deleteIssueType(projectKey, id));
}

export function useCreateLabel(projectKey: string) {
  return useProjectMutation(projectKey, (input: Parameters<typeof api.createLabel>[1]) =>
    api.createLabel(projectKey, input),
  );
}

export function useUpdateLabel(projectKey: string) {
  return useProjectMutation(
    projectKey,
    ({ id, patch }: { id: number; patch: Parameters<typeof api.updateLabel>[2] }) =>
      api.updateLabel(projectKey, id, patch),
  );
}

export function useDeleteLabel(projectKey: string) {
  return useProjectMutation(projectKey, (id: number) => api.deleteLabel(projectKey, id));
}

export function useCreateLabelGroup(projectKey: string) {
  return useProjectMutation(projectKey, (input: Parameters<typeof api.createLabelGroup>[1]) =>
    api.createLabelGroup(projectKey, input),
  );
}

export function useUpdateLabelGroup(projectKey: string) {
  return useProjectMutation(
    projectKey,
    ({ id, patch }: { id: number; patch: Parameters<typeof api.updateLabelGroup>[2] }) =>
      api.updateLabelGroup(projectKey, id, patch),
  );
}

export function useDeleteLabelGroup(projectKey: string) {
  return useProjectMutation(projectKey, (id: number) => api.deleteLabelGroup(projectKey, id));
}

// Configuration section: the project's auto-archive thresholds and subtask
// automations.
export function useAutoArchiveQuery(projectKey: string) {
  return useQuery({
    queryKey: qk.autoArchive(projectKey),
    queryFn: () => api.getAutoArchive(projectKey),
  });
}

export function useUpdateAutoArchive(projectKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AutoArchiveSettings) => api.updateAutoArchive(projectKey, input),
    onSuccess: (data) => qc.setQueryData(qk.autoArchive(projectKey), data),
  });
}

export function useSubtaskAutomationQuery(projectKey: string) {
  return useQuery({
    queryKey: qk.subtaskAutomation(projectKey),
    queryFn: () => api.getSubtaskAutomation(projectKey),
  });
}

export function useUpdateSubtaskAutomation(projectKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SubtaskAutomationSettings) =>
      api.updateSubtaskAutomation(projectKey, input),
    onSuccess: (data) => qc.setQueryData(qk.subtaskAutomation(projectKey), data),
  });
}

// The estimate kinds live on the project row, so the write invalidates the project
// detail the whole app reads them from rather than caching a payload of its own.
export function useUpdateEstimates(projectKey: string) {
  return useProjectMutation(projectKey, (input: EstimateSettings) =>
    api.updateEstimates(projectKey, input),
  );
}

// Repository section: the inbound webhook connection and its pull request automations.
export function useGitSettingsQuery(projectKey: string) {
  return useQuery({
    queryKey: qk.gitSettings(projectKey),
    queryFn: () => api.getGitSettings(projectKey),
  });
}

export function useUpdateGitSettings(projectKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Parameters<typeof api.updateGitSettings>[1]) =>
      api.updateGitSettings(projectKey, patch),
    onSuccess: (data) => qc.setQueryData(qk.gitSettings(projectKey), data),
  });
}

export function useRegenerateGitSecret(projectKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.regenerateGitSecret(projectKey),
    onSuccess: (data) => qc.setQueryData(qk.gitSettings(projectKey), data),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.gitConnections(projectKey) }),
  });
}

export function useGitProviderConnectionsQuery(projectKey: string) {
  return useQuery({
    queryKey: qk.gitConnections(projectKey),
    queryFn: () => api.listGitProviderConnections(projectKey),
  });
}

export function useConnectGitProvider(projectKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof api.connectGitProvider>[1]) =>
      api.connectGitProvider(projectKey, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.gitConnections(projectKey) }),
  });
}

export function useDisconnectGitProvider(projectKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (connectionId: number) => api.disconnectGitProvider(projectKey, connectionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.gitConnections(projectKey) }),
  });
}

export function useAvailableGitRepositoriesQuery(
  projectKey: string,
  connectionId: number,
  search: string,
  enabled: boolean,
) {
  return useInfiniteQuery({
    queryKey: qk.gitAvailableRepositories(projectKey, connectionId, search),
    queryFn: ({ pageParam }) =>
      api.listAvailableGitRepositories(projectKey, connectionId, { search, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (page) => page.nextPage ?? undefined,
    enabled,
  });
}

export function useConnectGitRepositories(projectKey: string, connectionId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (externalIds: string[]) =>
      api.connectGitRepositories(projectKey, connectionId, externalIds),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.gitConnections(projectKey) }),
  });
}

export function useDisconnectGitRepository(projectKey: string, connectionId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (repositoryId: number) =>
      api.disconnectGitRepository(projectKey, connectionId, repositoryId),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.gitConnections(projectKey) }),
  });
}

// General section: which optional sections the project shows. The current state
// comes with the project payload (getProject), so a write only invalidates it —
// the navigation and the sections themselves read it from there.
export function useUpdateProjectFeatures(projectKey: string) {
  const invalidate = useInvalidateProject(projectKey);
  return useMutation({
    mutationFn: (input: Partial<ProjectFeatures>) =>
      api.updateProjectSettings(projectKey, { features: input }),
    onSuccess: () => invalidate(),
  });
}

// Notifications section: the project's notification delivery settings. A write
// returns the redacted result, which replaces the cache directly.
export function useNotificationSettingsQuery(projectKey: string) {
  return useQuery({
    queryKey: qk.notificationSettings(projectKey),
    queryFn: () => api.getNotificationSettings(projectKey),
  });
}

export function useUpdateNotificationSettings(projectKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NotificationSettingsPatch) =>
      api.setNotificationSettings(projectKey, input),
    onSuccess: (data) => qc.setQueryData(qk.notificationSettings(projectKey), data),
  });
}

// The session member's own notification preferences for a project. A write returns
// the normalized result, which replaces the cache directly.
export function useNotificationPreferencesQuery(projectKey: string) {
  return useQuery({
    queryKey: qk.notificationPreferences(projectKey),
    queryFn: () => api.getNotificationPreferences(projectKey),
  });
}

export function useUpdateNotificationPreferences(projectKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NotificationPreferences) =>
      api.setNotificationPreferences(projectKey, input),
    onSuccess: (data) => qc.setQueryData(qk.notificationPreferences(projectKey), data),
  });
}

// Custom fields. Writes go through the project-scoped endpoint; the shared
// invalidation also refreshes the custom-field lists the reads depend on.
export function useCreateCustomField(projectKey: string) {
  return useProjectMutation(projectKey, (input: Parameters<typeof api.createCustomField>[1]) =>
    api.createCustomField(projectKey, input),
  );
}

export function useUpdateCustomField(projectKey: string) {
  return useProjectMutation(
    projectKey,
    ({ id, patch }: { id: number; patch: Parameters<typeof api.updateCustomField>[2] }) =>
      api.updateCustomField(projectKey, id, patch),
  );
}

export function useDeleteCustomField(projectKey: string) {
  return useProjectMutation(projectKey, (id: number) => api.deleteCustomField(projectKey, id));
}

// Issue templates. The project detail carries the list, so the writes only have to
// invalidate it.
export function useCreateIssueTemplate(projectKey: string) {
  return useProjectMutation(projectKey, (input: Parameters<typeof api.createIssueTemplate>[1]) =>
    api.createIssueTemplate(projectKey, input),
  );
}

export function useUpdateIssueTemplate(projectKey: string) {
  return useProjectMutation(
    projectKey,
    ({ id, patch }: { id: number; patch: Parameters<typeof api.updateIssueTemplate>[2] }) =>
      api.updateIssueTemplate(projectKey, id, patch),
  );
}

export function useDeleteIssueTemplate(projectKey: string) {
  return useProjectMutation(projectKey, (id: number) => api.deleteIssueTemplate(projectKey, id));
}
