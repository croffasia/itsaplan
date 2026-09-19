import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { qk } from './queryKeys';

export function useFilesQuery(projectKey: string) {
  return useQuery({
    queryKey: qk.projectFiles(projectKey),
    queryFn: () => api.listProjectFiles(projectKey),
    enabled: projectKey.length > 0,
  });
}

export function useUploadFile(projectKey: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      file,
      customerId,
      folder,
    }: {
      file: File;
      customerId?: string;
      folder?: string;
    }) => api.uploadProjectFile(projectKey, file, customerId, folder),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: qk.projectFiles(projectKey) }),
  });
}

export function useDeleteFile(projectKey: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (publicId: string) => api.deleteProjectFile(publicId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.projectFiles(projectKey) });
      toast.success('File deleted');
    },
  });
}
