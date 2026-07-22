// React Query hooks for everything the settings feature reads and writes: the
// project's structural entities (columns, issue types, labels and label groups,
// custom fields), the auto-archive thresholds, the project notification delivery
// settings, and the session member's own notification preferences. Structural
// writes go through useProjectMutation and invalidate the project detail; the
// settings and notification writes return the stored result and put it straight
// into the cache. This module wraps the low-level fetch client (api.ts).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  api,
  type AutoArchiveSettings,
  type NotificationSettingsPatch,
  type NotificationPreferences,
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
  return useMutation({ mutationFn, onSuccess: () => invalidate(true) });
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

// Archive section: the project's auto-archive thresholds, read from the project
// settings resource and narrowed to the autoArchive part for this section.
export function useAutoArchiveQuery(projectKey: string) {
  return useQuery({
    queryKey: qk.projectSettings(projectKey),
    queryFn: () => api.getProjectSettings(projectKey),
    select: (s) => s.autoArchive,
  });
}

export function useUpdateAutoArchive(projectKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AutoArchiveSettings) =>
      api.updateProjectSettings(projectKey, { autoArchive: input }),
    onSuccess: (data) => qc.setQueryData(qk.projectSettings(projectKey), data),
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
