// Issue attachment reads and writes, wrapping lib/api/endpoints/attachments.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type Attachment,
  listAttachments,
  uploadAttachment,
  replaceAttachment,
  deleteAttachment,
} from '@/lib/api/endpoints/attachments';
import { qk } from '@/services/queryKeys';

export function useAttachmentsQuery(id: number) {
  return useQuery({ queryKey: qk.attachments(id), queryFn: () => listAttachments(id) });
}

export function useUploadAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ issueId, file }: { issueId: number; file: File }): Promise<Attachment> =>
      uploadAttachment(issueId, file),
    onSuccess: (_data, { issueId }) =>
      void qc.invalidateQueries({ queryKey: qk.attachments(issueId) }),
  });
}

export function useReplaceAttachment(issueId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ publicId, file }: { publicId: string; file: File }): Promise<Attachment> =>
      replaceAttachment(publicId, file),
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.attachments(issueId) }),
  });
}

export function useDeleteAttachment(issueId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (publicId: string) => deleteAttachment(publicId),
    // Deleting also strips the attachment's embeds from the description and
    // markdown field values, so refetch the issue alongside the panel list.
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.attachments(issueId) });
      void qc.invalidateQueries({ queryKey: qk.issue(issueId) });
    },
  });
}
