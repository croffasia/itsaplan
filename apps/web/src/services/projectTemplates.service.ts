import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteProjectTemplate,
  getProjectTemplate,
  listProjectTemplates,
  saveProjectTemplate,
} from '@/lib/api/endpoints/project-templates';
import { qk } from '@/services/queryKeys';

// The team list carries how many templates each team holds, so a save or a delete
// refreshes it too.
function useTemplateMutation<TInput, TResult>(
  teamId: number,
  mutationFn: (input: TInput) => Promise<TResult>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.projectTemplates(teamId) });
      qc.invalidateQueries({ queryKey: qk.teams });
    },
  });
}

// The team's project templates. Pass null where the caller has no use for them, to skip
// the request.
export function useProjectTemplatesQuery(teamId: number | null) {
  return useQuery({
    queryKey: qk.projectTemplates(teamId ?? 0),
    queryFn: () => listProjectTemplates(teamId!),
    enabled: teamId != null,
  });
}

// What one template holds, read when its row is opened.
export function useProjectTemplateQuery(teamId: number, templateId: number) {
  return useQuery({
    queryKey: qk.projectTemplate(teamId, templateId),
    queryFn: () => getProjectTemplate(teamId, templateId),
  });
}

export function useSaveProjectTemplate(teamId: number) {
  return useTemplateMutation(teamId, (input: Parameters<typeof saveProjectTemplate>[1]) =>
    saveProjectTemplate(teamId, input),
  );
}

export function useDeleteProjectTemplate(teamId: number) {
  return useTemplateMutation(teamId, (templateId: number) =>
    deleteProjectTemplate(teamId, templateId),
  );
}
