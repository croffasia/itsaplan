// Initiative attachment reads and writes, over the same fetch client the rest of
// the app uses.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Attachment } from '@/lib/api';
import { qk } from '@/services/queryKeys';

export function useInitiativeAttachmentsQuery(initiativeId: number) {
  return useQuery({
    queryKey: qk.initiativeAttachments(initiativeId),
    queryFn: () => api.listInitiativeAttachments(initiativeId),
  });
}

export function useUploadInitiativeAttachment(initiativeId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File): Promise<Attachment> =>
      api.uploadInitiativeAttachment(initiativeId, file),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: qk.initiativeAttachments(initiativeId) }),
  });
}

export function useDeleteInitiativeAttachment(initiativeId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (publicId: string) => api.deleteInitiativeAttachment(publicId),
    // Deleting also strips the attachment's embeds from the description, so
    // refetch the initiative alongside the list.
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.initiativeAttachments(initiativeId) });
      void qc.invalidateQueries({ queryKey: qk.initiative(initiativeId) });
    },
  });
}
