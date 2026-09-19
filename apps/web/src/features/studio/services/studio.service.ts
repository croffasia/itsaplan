import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  api,
  type StudioPostInput,
  type StudioPostPatch,
  type StudioTemplateInput,
  type StudioTemplatePatch,
} from '@/lib/api';
import { qk } from '@/services/queryKeys';

export function useStudioTemplatesQuery(projectKey: string) {
  return useQuery({
    queryKey: qk.studioTemplates(projectKey),
    queryFn: () => api.listStudioTemplates(projectKey),
    enabled: projectKey.length > 0,
  });
}

export function useStudioPostsQuery(projectKey: string) {
  return useQuery({
    queryKey: qk.studioPosts(projectKey),
    queryFn: () => api.listStudioPosts(projectKey),
    enabled: projectKey.length > 0,
  });
}

// The OpenRouter catalogue changes rarely and the API caches it for a day, so the
// form does not refetch it while the page is open.
export function useStudioModelsQuery(projectKey: string) {
  return useQuery({
    queryKey: qk.studioModels(projectKey),
    queryFn: () => api.listStudioModels(projectKey),
    enabled: projectKey.length > 0,
    staleTime: 60 * 60 * 1000,
  });
}

function useInvalidateTemplates(projectKey: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: qk.studioTemplates(projectKey) });
  };
}

function useInvalidatePosts(projectKey: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: qk.studioPosts(projectKey) });
  };
}

export function useCreateStudioTemplate(projectKey: string) {
  const invalidate = useInvalidateTemplates(projectKey);
  return useMutation({
    mutationFn: (input: StudioTemplateInput) => api.createStudioTemplate(projectKey, input),
    onSuccess: (template) => {
      invalidate();
      toast.success(`Template "${template.name}" created`);
    },
  });
}

export function useUpdateStudioTemplate(projectKey: string) {
  const invalidate = useInvalidateTemplates(projectKey);
  return useMutation({
    mutationFn: (input: { templateId: string; patch: StudioTemplatePatch }) =>
      api.updateStudioTemplate(input.templateId, input.patch),
    onSuccess: () => {
      invalidate();
      toast.success('Template saved');
    },
  });
}

export function useDeleteStudioTemplate(projectKey: string) {
  const invalidate = useInvalidateTemplates(projectKey);
  return useMutation({
    mutationFn: (templateId: string) => api.deleteStudioTemplate(templateId),
    onSuccess: invalidate,
  });
}

export function useCreateStudioPost(projectKey: string) {
  const invalidate = useInvalidatePosts(projectKey);
  return useMutation({
    mutationFn: (input: StudioPostInput) => api.createStudioPost(projectKey, input),
    onSuccess: invalidate,
  });
}

export function useUpdateStudioPost(projectKey: string) {
  const invalidate = useInvalidatePosts(projectKey);
  return useMutation({
    mutationFn: (input: { postId: string; patch: StudioPostPatch }) =>
      api.updateStudioPost(input.postId, input.patch),
    onSuccess: invalidate,
  });
}

export function useDeleteStudioPost(projectKey: string) {
  const invalidate = useInvalidatePosts(projectKey);
  return useMutation({
    mutationFn: (postId: string) => api.deleteStudioPost(postId),
    onSuccess: invalidate,
  });
}

export function useGenerateStudioCopy(projectKey: string) {
  const invalidate = useInvalidatePosts(projectKey);
  return useMutation({
    mutationFn: (postId: string) => api.generateStudioCopy(postId),
    onSuccess: invalidate,
  });
}

export function useGenerateStudioImage(projectKey: string) {
  const invalidate = useInvalidatePosts(projectKey);
  return useMutation({
    mutationFn: (postId: string) => api.generateStudioImage(postId),
    onSuccess: invalidate,
  });
}

export function useSaveRenderedPost(projectKey: string) {
  const invalidate = useInvalidatePosts(projectKey);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { postId: string; blob: Blob }) =>
      api.storeRenderedStudioPost(input.postId, input.blob),
    onSuccess: (post) => {
      invalidate();
      void queryClient.invalidateQueries({ queryKey: qk.projectFiles(projectKey) });
      toast.success(`Saved to the vault folder "${post.folder}"`);
    },
  });
}
