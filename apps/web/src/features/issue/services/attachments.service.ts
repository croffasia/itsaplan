// Issue attachment reads and writes. The low-level fetch client (api.ts) is
// untouched; this module wraps it.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Attachment } from '@/lib/api';
import { qk } from '@/services/queryKeys';

export function useAttachmentsQuery(id: number) {
  return useQuery({ queryKey: qk.attachments(id), queryFn: () => api.listAttachments(id) });
}

export function useUploadAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ issueId, file }: { issueId: number; file: File }): Promise<Attachment> =>
      api.uploadAttachment(issueId, file),
    onSuccess: (_data, { issueId }) =>
      void qc.invalidateQueries({ queryKey: qk.attachments(issueId) }),
  });
}

export function useDeleteAttachment(issueId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (publicId: string) => api.deleteAttachment(publicId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.attachments(issueId) }),
  });
}
