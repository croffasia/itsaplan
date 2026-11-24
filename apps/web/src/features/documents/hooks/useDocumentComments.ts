import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addDocumentComment, updateDocumentComment } from '@/lib/api/endpoints/documents';
import { qk } from '@/services/queryKeys';
import type { DocumentSelection } from '../components/DocumentSelectionActions';
import { useDocumentCommentsQuery } from '../services/documents.service';

// The comments of a page and the writes on them. Starting a thread renders its own
// error, since the usual cause is text that changed under the selection.
export function useDocumentComments(projectKey: string, documentId: number, version: number) {
  const qc = useQueryClient();
  const key = qk.documentComments(projectKey, documentId);
  const refresh = () => qc.invalidateQueries({ queryKey: key });
  const query = useDocumentCommentsQuery(projectKey, documentId);
  const start = useMutation({
    meta: { suppressErrorToast: true },
    mutationFn: (input: DocumentSelection & { body: string }) =>
      addDocumentComment(projectKey, documentId, {
        ...input,
        quote: input.quote.slice(0, 2000),
        version: input.version ?? version,
      }),
    onSuccess: refresh,
  });
  const reply = useMutation({
    mutationFn: (input: { parentId: string; body: string }) =>
      addDocumentComment(projectKey, documentId, { ...input, version }),
    onSuccess: refresh,
  });
  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: { body?: string; resolved?: boolean } }) =>
      updateDocumentComment(projectKey, documentId, id, input),
    onSuccess: refresh,
  });
  return { query, start, reply, update };
}
