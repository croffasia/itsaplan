import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteProjectTemplate,
  getTeamProjectTemplate,
  getTemplatePublisher,
  getWorkspaceProjectTemplate,
  importProjectTemplate,
  linkTemplatePublisher,
  listTeamProjectTemplates,
  listWorkspaceProjectTemplates,
  previewImportedTemplate,
  previewProjectTemplate,
  publishTemplate,
  requestPublisherCode,
  saveProjectTemplate,
  setTemplatePublisherAuthor,
  unlinkTemplatePublisher,
  unpublishTemplate,
  updateProjectTemplate,
  type ProjectTemplateDetail,
  type SharedProjectTemplate,
} from '@/lib/api/endpoints/project-templates';
import { qk } from '@/services/queryKeys';

function useTemplateMutation<TInput, TResult>(mutationFn: (input: TInput) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.projectTemplates }),
  });
}

// The templates a team sees, for creating its projects. Pass null where the caller has
// no use for them, to skip the request.
export function useTeamProjectTemplatesQuery(teamId: number | null) {
  return useQuery({
    queryKey: qk.teamProjectTemplates(teamId ?? 0),
    queryFn: () => listTeamProjectTemplates(teamId!),
    enabled: teamId != null,
  });
}

export function useWorkspaceProjectTemplatesQuery(workspaceId: number) {
  return useQuery({
    queryKey: qk.workspaceProjectTemplates(workspaceId),
    queryFn: () => listWorkspaceProjectTemplates(workspaceId),
  });
}

// Where a template is read from: the team that creates a project from it, or the workspace
// that holds it.
export type TemplateScope = { teamId: number } | { workspaceId: number };

// What one template holds, read when it is opened.
export function useProjectTemplateQuery(scope: TemplateScope, templateId: number) {
  return useQuery<ProjectTemplateDetail, Error, ProjectTemplateDetail, readonly unknown[]>({
    queryKey:
      'teamId' in scope
        ? qk.teamProjectTemplate(scope.teamId, templateId)
        : qk.workspaceProjectTemplate(scope.workspaceId, templateId),
    queryFn: () =>
      'teamId' in scope
        ? getTeamProjectTemplate(scope.teamId, templateId)
        : getWorkspaceProjectTemplate(scope.workspaceId, templateId),
  });
}

// What a template of the project would hold with this selection. The previous answer
// stays on screen while the next one loads, so a toggled section does not blank it.
export function useProjectTemplatePreviewQuery(
  workspaceId: number,
  projectId: number | null,
  include: Record<string, boolean>,
) {
  return useQuery({
    queryKey: qk.projectTemplatePreview(workspaceId, projectId ?? 0, include),
    queryFn: () => previewProjectTemplate(workspaceId, { projectId: projectId!, include }),
    enabled: projectId != null,
    placeholderData: keepPreviousData,
  });
}

// What a pasted template would hold once imported. The server refuses one that is not a
// template or is damaged, which is an answer, not a failure to retry.
export function useImportedTemplatePreviewQuery(
  workspaceId: number,
  template: SharedProjectTemplate | null,
) {
  return useQuery({
    queryKey: qk.importedTemplatePreview(workspaceId, template),
    queryFn: () => previewImportedTemplate(workspaceId, template!),
    enabled: template !== null,
    retry: false,
  });
}

export function useImportProjectTemplate(workspaceId: number) {
  return useTemplateMutation((input: Parameters<typeof importProjectTemplate>[1]) =>
    importProjectTemplate(workspaceId, input),
  );
}

export function useSaveProjectTemplate(workspaceId: number) {
  return useTemplateMutation((input: Parameters<typeof saveProjectTemplate>[1]) =>
    saveProjectTemplate(workspaceId, input),
  );
}

export function useUpdateProjectTemplate(workspaceId: number) {
  return useTemplateMutation(
    ({
      templateId,
      patch,
    }: {
      templateId: number;
      patch: Parameters<typeof updateProjectTemplate>[2];
    }) => updateProjectTemplate(workspaceId, templateId, patch),
  );
}

export function useTemplatePublisherQuery(workspaceId: number) {
  return useQuery({
    queryKey: qk.templatePublisher(workspaceId),
    queryFn: () => getTemplatePublisher(workspaceId),
  });
}

export function useRequestPublisherCode(workspaceId: number) {
  return useMutation({ mutationFn: (email: string) => requestPublisherCode(workspaceId, email) });
}

// Each of these changes the publisher, the templates, or both.
function usePublisherMutation<TInput, TResult>(
  workspaceId: number,
  mutationFn: (input: TInput) => Promise<TResult>,
  meta?: { suppressErrorToast: true },
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    meta,
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: qk.projectTemplates }),
        qc.invalidateQueries({ queryKey: qk.templatePublisher(workspaceId) }),
      ]),
  });
}

// A refused code shows under the code cells.
export function useLinkTemplatePublisher(workspaceId: number) {
  return usePublisherMutation(
    workspaceId,
    (input: { email: string; code: string }) => linkTemplatePublisher(workspaceId, input),
    { suppressErrorToast: true },
  );
}

export function useUnlinkTemplatePublisher(workspaceId: number) {
  return usePublisherMutation(workspaceId, () => unlinkTemplatePublisher(workspaceId));
}

export function useSetPublisherAuthor(workspaceId: number) {
  return usePublisherMutation(
    workspaceId,
    (author: Parameters<typeof setTemplatePublisherAuthor>[1]) =>
      setTemplatePublisherAuthor(workspaceId, author),
  );
}

export function usePublishTemplate(workspaceId: number) {
  return usePublisherMutation(workspaceId, (templateId: number) =>
    publishTemplate(workspaceId, templateId),
  );
}

export function useUnpublishTemplate(workspaceId: number) {
  return useTemplateMutation((templateId: number) => unpublishTemplate(workspaceId, templateId));
}

export function useDeleteProjectTemplate(workspaceId: number) {
  return useTemplateMutation((templateId: number) =>
    deleteProjectTemplate(workspaceId, templateId),
  );
}
