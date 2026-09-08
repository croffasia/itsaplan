// React Query hooks for everything the settings feature reads and writes: the
// project's structural entities (columns, issue types, labels and label groups,
// custom fields, issue templates), the workflow configuration, and the session
// member's own notification preferences. Structural writes go through
// useProjectMutation and invalidate the project detail; the settings and
// notification writes return the stored result and put it straight into the cache.
// This module wraps the low-level fetch client (api.ts).

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type AutoArchiveSettings,
  type EstimateSettings,
  type ProjectFeatures,
  type SubtaskAutomationSettings,
  getAutoArchive,
  updateAutoArchive,
  getSubtaskAutomation,
  updateSubtaskAutomation,
  updateEstimates,
  updateProjectSettings,
} from '@/lib/api/endpoints/settings';
import {
  createColumn,
  updateColumn,
  reorderColumns,
  deleteColumn,
} from '@/lib/api/endpoints/columns';
import {
  createCustomField,
  updateCustomField,
  deleteCustomField,
} from '@/lib/api/endpoints/customFields';
import {
  getGitSettings,
  updateGitSettings,
  regenerateGitSecret,
  listGitProviderConnections,
  connectGitProvider,
  disconnectGitProvider,
  listAvailableGitRepositories,
  connectGitRepositories,
  disconnectGitRepository,
} from '@/lib/api/endpoints/git';
import {
  createIssueTemplate,
  updateIssueTemplate,
  deleteIssueTemplate,
} from '@/lib/api/endpoints/issueTemplates';
import { createIssueType, updateIssueType, deleteIssueType } from '@/lib/api/endpoints/issueTypes';
import {
  createLabel,
  updateLabel,
  deleteLabel,
  createLabelGroup,
  updateLabelGroup,
  deleteLabelGroup,
} from '@/lib/api/endpoints/labels';
import {
  type NotificationPreferences,
  getNotificationPreferences,
  setNotificationPreferences,
} from '@/lib/api/endpoints/notificationPreferences';
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
  return useProjectMutation(projectKey, (input: Parameters<typeof createColumn>[1]) =>
    createColumn(projectKey, input),
  );
}

export function useUpdateColumn(projectKey: string) {
  return useProjectMutation(
    projectKey,
    ({ id, patch }: { id: number; patch: Parameters<typeof updateColumn>[2] }) =>
      updateColumn(projectKey, id, patch),
  );
}

export function useReorderColumns(projectKey: string) {
  return useProjectMutation(projectKey, (orderedIds: number[]) =>
    reorderColumns(projectKey, orderedIds),
  );
}

export function useDeleteColumn(projectKey: string) {
  return useProjectMutation(
    projectKey,
    ({ id, body }: { id: number; body: Parameters<typeof deleteColumn>[2] }) =>
      deleteColumn(projectKey, id, body),
  );
}

export function useCreateIssueType(projectKey: string) {
  return useProjectMutation(projectKey, (input: Parameters<typeof createIssueType>[1]) =>
    createIssueType(projectKey, input),
  );
}

export function useUpdateIssueType(projectKey: string) {
  return useProjectMutation(
    projectKey,
    ({ id, patch }: { id: number; patch: Parameters<typeof updateIssueType>[2] }) =>
      updateIssueType(projectKey, id, patch),
  );
}

export function useDeleteIssueType(projectKey: string) {
  return useProjectMutation(projectKey, (id: number) => deleteIssueType(projectKey, id));
}

export function useCreateLabel(projectKey: string) {
  return useProjectMutation(projectKey, (input: Parameters<typeof createLabel>[1]) =>
    createLabel(projectKey, input),
  );
}

export function useUpdateLabel(projectKey: string) {
  return useProjectMutation(
    projectKey,
    ({ id, patch }: { id: number; patch: Parameters<typeof updateLabel>[2] }) =>
      updateLabel(projectKey, id, patch),
  );
}

export function useDeleteLabel(projectKey: string) {
  return useProjectMutation(projectKey, (id: number) => deleteLabel(projectKey, id));
}

export function useCreateLabelGroup(projectKey: string) {
  return useProjectMutation(projectKey, (input: Parameters<typeof createLabelGroup>[1]) =>
    createLabelGroup(projectKey, input),
  );
}

export function useUpdateLabelGroup(projectKey: string) {
  return useProjectMutation(
    projectKey,
    ({ id, patch }: { id: number; patch: Parameters<typeof updateLabelGroup>[2] }) =>
      updateLabelGroup(projectKey, id, patch),
  );
}

export function useDeleteLabelGroup(projectKey: string) {
  return useProjectMutation(projectKey, (id: number) => deleteLabelGroup(projectKey, id));
}

// Configuration section: the project's auto-archive thresholds and subtask
// automations.
export function useAutoArchiveQuery(projectKey: string) {
  return useQuery({
    queryKey: qk.autoArchive(projectKey),
    queryFn: () => getAutoArchive(projectKey),
  });
}

export function useUpdateAutoArchive(projectKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AutoArchiveSettings) => updateAutoArchive(projectKey, input),
    onSuccess: (data) => qc.setQueryData(qk.autoArchive(projectKey), data),
  });
}

export function useSubtaskAutomationQuery(projectKey: string) {
  return useQuery({
    queryKey: qk.subtaskAutomation(projectKey),
    queryFn: () => getSubtaskAutomation(projectKey),
  });
}

export function useUpdateSubtaskAutomation(projectKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SubtaskAutomationSettings) => updateSubtaskAutomation(projectKey, input),
    onSuccess: (data) => qc.setQueryData(qk.subtaskAutomation(projectKey), data),
  });
}

// The estimate kinds live on the project row, so the write invalidates the project
// detail the whole app reads them from rather than caching a payload of its own.
export function useUpdateEstimates(projectKey: string) {
  return useProjectMutation(projectKey, (input: EstimateSettings) =>
    updateEstimates(projectKey, input),
  );
}

// Repository section: the inbound webhook connection and its pull request automations.
export function useGitSettingsQuery(projectKey: string) {
  return useQuery({
    queryKey: qk.gitSettings(projectKey),
    queryFn: () => getGitSettings(projectKey),
  });
}

export function useUpdateGitSettings(projectKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Parameters<typeof updateGitSettings>[1]) =>
      updateGitSettings(projectKey, patch),
    onSuccess: (data) => qc.setQueryData(qk.gitSettings(projectKey), data),
  });
}

export function useRegenerateGitSecret(projectKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => regenerateGitSecret(projectKey),
    onSuccess: (data) => qc.setQueryData(qk.gitSettings(projectKey), data),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.gitConnections(projectKey) }),
  });
}

export function useGitProviderConnectionsQuery(projectKey: string) {
  return useQuery({
    queryKey: qk.gitConnections(projectKey),
    queryFn: () => listGitProviderConnections(projectKey),
  });
}

export function useConnectGitProvider(projectKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof connectGitProvider>[1]) =>
      connectGitProvider(projectKey, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.gitConnections(projectKey) }),
  });
}

export function useDisconnectGitProvider(projectKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (connectionId: number) => disconnectGitProvider(projectKey, connectionId),
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
      listAvailableGitRepositories(projectKey, connectionId, { search, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (page) => page.nextPage ?? undefined,
    enabled,
  });
}

export function useConnectGitRepositories(projectKey: string, connectionId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (externalIds: string[]) =>
      connectGitRepositories(projectKey, connectionId, externalIds),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.gitConnections(projectKey) }),
  });
}

export function useDisconnectGitRepository(projectKey: string, connectionId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (repositoryId: number) =>
      disconnectGitRepository(projectKey, connectionId, repositoryId),
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
      updateProjectSettings(projectKey, { features: input }),
    onSuccess: () => invalidate(),
  });
}

// The session member's own notification preferences for a project. A write returns
// the normalized result, which replaces the cache directly.
export function useNotificationPreferencesQuery(projectKey: string) {
  return useQuery({
    queryKey: qk.notificationPreferences(projectKey),
    queryFn: () => getNotificationPreferences(projectKey),
  });
}

export function useUpdateNotificationPreferences(projectKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NotificationPreferences) => setNotificationPreferences(projectKey, input),
    onSuccess: (data) => qc.setQueryData(qk.notificationPreferences(projectKey), data),
  });
}

// Custom fields. Writes go through the project-scoped endpoint; the shared
// invalidation also refreshes the custom-field lists the reads depend on.
export function useCreateCustomField(projectKey: string) {
  return useProjectMutation(projectKey, (input: Parameters<typeof createCustomField>[1]) =>
    createCustomField(projectKey, input),
  );
}

export function useUpdateCustomField(projectKey: string) {
  return useProjectMutation(
    projectKey,
    ({ id, patch }: { id: number; patch: Parameters<typeof updateCustomField>[2] }) =>
      updateCustomField(projectKey, id, patch),
  );
}

export function useDeleteCustomField(projectKey: string) {
  return useProjectMutation(projectKey, (id: number) => deleteCustomField(projectKey, id));
}

// Issue templates. The project detail carries the list, so the writes only have to
// invalidate it.
export function useCreateIssueTemplate(projectKey: string) {
  return useProjectMutation(projectKey, (input: Parameters<typeof createIssueTemplate>[1]) =>
    createIssueTemplate(projectKey, input),
  );
}

export function useUpdateIssueTemplate(projectKey: string) {
  return useProjectMutation(
    projectKey,
    ({ id, patch }: { id: number; patch: Parameters<typeof updateIssueTemplate>[2] }) =>
      updateIssueTemplate(projectKey, id, patch),
  );
}

export function useDeleteIssueTemplate(projectKey: string) {
  return useProjectMutation(projectKey, (id: number) => deleteIssueTemplate(projectKey, id));
}
