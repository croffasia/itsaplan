import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type DocumentIssueLink,
  type DocumentAsset,
  type IssueDocumentLink,
  type NewProjectDocumentInput,
  type ProjectDocument,
  type ProjectDocumentPatch,
  type ProjectDocumentRevisionSummary,
  type ProjectDocumentSummary,
  listDocuments,
  getDocument,
  listDocumentIssueLinks,
  listIssueDocumentLinks,
  linkDocumentIssue,
  unlinkDocumentIssue,
  listInitiativeDocumentLinks,
  linkDocumentInitiative,
  unlinkDocumentInitiative,
  createDocument,
  duplicateDocument,
  setDocumentAccess,
  setDocumentLocked,
  archiveDocument,
  restoreDocument,
  setDocumentFavorite,
  listDocumentRevisions,
  listDocumentAssets,
  uploadDocumentAsset,
  deleteDocumentAsset,
  restoreDocumentRevision,
  updateDocument,
  deleteDocument,
} from '@/lib/api/endpoints/documents';
import { qk } from '@/services/queryKeys';
import { applyOptimisticDocumentMove } from '../utils/documentMove';

function summaryOf(document: ProjectDocument): ProjectDocumentSummary {
  const { content: _content, contentJson: _contentJson, ...summary } = document;
  return summary;
}

function invalidateLists(qc: ReturnType<typeof useQueryClient>, projectKey: string) {
  void qc.invalidateQueries({ queryKey: qk.documentListsForProject(projectKey) });
}

export function useDocumentsQuery(
  projectKey: string | null,
  q = '',
  archived = false,
  enabled = true,
) {
  return useQuery({
    queryKey: qk.documents(projectKey ?? '', q, archived),
    queryFn: () => listDocuments(projectKey!, q || undefined, archived),
    enabled: enabled && projectKey != null,
    staleTime: 30_000,
  });
}

export function useDocumentQuery(projectKey: string | null, documentId: number | null) {
  return useQuery({
    queryKey: qk.document(projectKey ?? '', documentId ?? 0),
    queryFn: () => getDocument(projectKey!, documentId!),
    enabled: projectKey != null && documentId != null,
    refetchOnMount: 'always',
  });
}

export function useDocumentIssueLinksQuery(
  projectKey: string | null,
  documentId: number | null,
  enabled = true,
) {
  return useQuery<DocumentIssueLink[]>({
    queryKey: qk.documentIssueLinks(projectKey ?? '', documentId ?? 0),
    queryFn: () => listDocumentIssueLinks(projectKey!, documentId!),
    enabled: enabled && projectKey != null && documentId != null,
  });
}

export function useIssueDocumentLinksQuery(
  projectKey: string | null,
  issueId: number | null,
  enabled = true,
) {
  return useQuery<IssueDocumentLink[]>({
    queryKey: qk.issueDocumentLinks(projectKey ?? '', issueId ?? 0),
    queryFn: () => listIssueDocumentLinks(projectKey!, issueId!),
    enabled: enabled && projectKey != null && issueId != null,
  });
}

export function useLinkDocumentIssue(projectKey: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ documentId, issueId }: { documentId: number; issueId: number }) =>
      linkDocumentIssue(projectKey!, documentId, issueId),
    onSuccess: (_link, { documentId, issueId }) => {
      if (!projectKey) return;
      void qc.invalidateQueries({ queryKey: qk.documentIssueLinks(projectKey, documentId) });
      void qc.invalidateQueries({ queryKey: qk.issueDocumentLinks(projectKey, issueId) });
    },
  });
}

export function useUnlinkDocumentIssue(projectKey: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ documentId, issueId }: { documentId: number; issueId: number }) =>
      unlinkDocumentIssue(projectKey!, documentId, issueId),
    onSuccess: (_result, { documentId, issueId }) => {
      if (!projectKey) return;
      void qc.invalidateQueries({ queryKey: qk.documentIssueLinks(projectKey, documentId) });
      void qc.invalidateQueries({ queryKey: qk.issueDocumentLinks(projectKey, issueId) });
    },
  });
}

export function useInitiativeDocumentLinksQuery(
  projectKey: string | null,
  initiativeId: number | null,
  enabled = true,
) {
  return useQuery<IssueDocumentLink[]>({
    queryKey: qk.initiativeDocumentLinks(projectKey ?? '', initiativeId ?? 0),
    queryFn: () => listInitiativeDocumentLinks(projectKey!, initiativeId!),
    enabled: enabled && projectKey != null && initiativeId != null,
  });
}

export function useLinkDocumentInitiative(projectKey: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ documentId, initiativeId }: { documentId: number; initiativeId: number }) =>
      linkDocumentInitiative(projectKey!, documentId, initiativeId),
    onSuccess: (_link, { initiativeId }) => {
      if (!projectKey) return;
      void qc.invalidateQueries({ queryKey: qk.initiativeDocumentLinks(projectKey, initiativeId) });
    },
  });
}

export function useUnlinkDocumentInitiative(projectKey: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ documentId, initiativeId }: { documentId: number; initiativeId: number }) =>
      unlinkDocumentInitiative(projectKey!, documentId, initiativeId),
    onSuccess: (_result, { initiativeId }) => {
      if (!projectKey) return;
      void qc.invalidateQueries({ queryKey: qk.initiativeDocumentLinks(projectKey, initiativeId) });
    },
  });
}

export function useCreateDocument(projectKey: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NewProjectDocumentInput) => createDocument(projectKey!, input),
    onSuccess: (document) => {
      if (!projectKey) return;
      qc.setQueryData<ProjectDocument>(qk.document(projectKey, document.id), document);
      invalidateLists(qc, projectKey);
    },
  });
}

export function useDuplicateDocument(projectKey: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      documentId,
      version,
      title,
      parentId,
    }: {
      documentId: number;
      version: number;
      title: string;
      parentId: number | null;
    }) => duplicateDocument(projectKey!, documentId, { version, title, parentId }),
    onSuccess: (document) => {
      if (!projectKey) return;
      qc.setQueryData<ProjectDocument>(qk.document(projectKey, document.id), document);
      invalidateLists(qc, projectKey);
    },
  });
}

function cacheDocument(
  qc: ReturnType<typeof useQueryClient>,
  projectKey: string,
  document: ProjectDocument,
) {
  qc.setQueryData<ProjectDocument>(qk.document(projectKey, document.id), document);
  invalidateLists(qc, projectKey);
}

function useDocumentMutation<TInput>(
  projectKey: string | null,
  mutationFn: (input: TInput) => Promise<ProjectDocument>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (document) => {
      if (!projectKey) return;
      cacheDocument(qc, projectKey, document);
    },
  });
}

export function useSetDocumentAccess(projectKey: string | null) {
  return useDocumentMutation(
    projectKey,
    ({
      documentId,
      version,
      isPrivate,
    }: {
      documentId: number;
      version: number;
      isPrivate: boolean;
    }) => setDocumentAccess(projectKey!, documentId, { version, isPrivate }),
  );
}

export function useSetDocumentLocked(projectKey: string | null) {
  return useDocumentMutation(
    projectKey,
    ({ documentId, version, locked }: { documentId: number; version: number; locked: boolean }) =>
      setDocumentLocked(projectKey!, documentId, version, locked),
  );
}

export function useArchiveDocument(projectKey: string | null) {
  return useDocumentMutation(
    projectKey,
    ({ documentId, version }: { documentId: number; version: number }) =>
      archiveDocument(projectKey!, documentId, version),
  );
}

export function useRestoreDocument(projectKey: string | null) {
  return useDocumentMutation(
    projectKey,
    ({ documentId, version }: { documentId: number; version: number }) =>
      restoreDocument(projectKey!, documentId, version),
  );
}

export function useSetDocumentFavorite(projectKey: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ documentId, isFavorite }: { documentId: number; isFavorite: boolean }) =>
      setDocumentFavorite(projectKey!, documentId, isFavorite),
    onMutate: async ({ documentId, isFavorite }) => {
      if (!projectKey) return;
      await qc.cancelQueries({ queryKey: qk.documentListsForProject(projectKey) });
      await qc.cancelQueries({ queryKey: qk.document(projectKey, documentId) });
      const previousDocument = qc.getQueryData<ProjectDocument>(
        qk.document(projectKey, documentId),
      );
      const previousLists = qc.getQueriesData<ProjectDocumentSummary[]>({
        queryKey: qk.documentListsForProject(projectKey),
      });
      qc.setQueryData<ProjectDocument>(qk.document(projectKey, documentId), (previous) =>
        previous ? { ...previous, isFavorite } : previous,
      );
      qc.setQueriesData<ProjectDocumentSummary[]>(
        { queryKey: qk.documentListsForProject(projectKey) },
        (previous) =>
          previous?.map((item) => (item.id === documentId ? { ...item, isFavorite } : item)),
      );
      return { previousDocument, previousLists };
    },
    onError: (_error, { documentId }, context) => {
      if (!projectKey || !context) return;
      qc.setQueryData(qk.document(projectKey, documentId), context.previousDocument);
      for (const [queryKey, data] of context.previousLists) qc.setQueryData(queryKey, data);
    },
    onSettled: (_result, _error, { documentId }) => {
      if (!projectKey) return;
      void qc.invalidateQueries({ queryKey: qk.document(projectKey, documentId) });
      invalidateLists(qc, projectKey);
    },
  });
}

export function useDocumentRevisionsQuery(
  projectKey: string | null,
  documentId: number | null,
  enabled: boolean,
) {
  return useQuery<ProjectDocumentRevisionSummary[]>({
    queryKey: qk.documentRevisions(projectKey ?? '', documentId ?? 0),
    queryFn: () => listDocumentRevisions(projectKey!, documentId!),
    enabled: enabled && projectKey != null && documentId != null,
  });
}

export function useDocumentAssetsQuery(projectKey: string | null, documentId: number | null) {
  return useQuery<DocumentAsset[]>({
    queryKey: qk.documentAssets(projectKey ?? '', documentId ?? 0),
    queryFn: () => listDocumentAssets(projectKey!, documentId!),
    enabled: projectKey != null && documentId != null,
  });
}

export function useUploadDocumentAsset(projectKey: string | null, documentId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadDocumentAsset(projectKey!, documentId!, file),
    onSuccess: (asset) => {
      if (!projectKey || documentId === null) return;
      qc.setQueryData<DocumentAsset[]>(qk.documentAssets(projectKey, documentId), (previous) => [
        asset,
        ...(previous ?? []),
      ]);
    },
  });
}

export function useDeleteDocumentAsset(projectKey: string | null, documentId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (publicId: string) => deleteDocumentAsset(projectKey!, documentId!, publicId),
    onSuccess: (_result, publicId) => {
      if (!projectKey || documentId === null) return;
      qc.setQueryData<DocumentAsset[]>(qk.documentAssets(projectKey, documentId), (previous) =>
        previous?.filter((asset) => asset.id !== publicId),
      );
    },
  });
}

export function useRestoreDocumentRevision(projectKey: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      documentId,
      revisionId,
      version,
    }: {
      documentId: number;
      revisionId: number;
      version: number;
    }) => restoreDocumentRevision(projectKey!, documentId, revisionId, version),
    onSuccess: (document) => {
      if (!projectKey) return;
      cacheDocument(qc, projectKey, document);
      void qc.invalidateQueries({ queryKey: qk.documentRevisions(projectKey, document.id) });
    },
  });
}

export function useUpdateDocument(projectKey: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ documentId, patch }: { documentId: number; patch: ProjectDocumentPatch }) =>
      updateDocument(projectKey!, documentId, patch),
    onSuccess: (document) => {
      if (!projectKey) return;
      qc.setQueryData<ProjectDocument>(qk.document(projectKey, document.id), document);
      qc.setQueriesData<ProjectDocumentSummary[]>(
        { queryKey: qk.documentListsForProject(projectKey) },
        (previous) =>
          previous?.map((item) => (item.id === document.id ? summaryOf(document) : item)),
      );
      void qc.invalidateQueries({
        queryKey: qk.documentListsForProject(projectKey),
        predicate: (query) => Boolean(query.queryKey[4]),
      });
    },
  });
}

export function useMoveDocument(projectKey: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      documentId,
      version,
      parentId,
      position,
      previousSiblingId,
      nextSiblingId,
    }: {
      documentId: number;
      version: number;
      parentId: number | null;
      position: number;
      previousSiblingId: number | null;
      nextSiblingId: number | null;
    }) =>
      updateDocument(projectKey!, documentId, {
        version,
        parentId,
        position,
        previousSiblingId,
        nextSiblingId,
      }),
    onMutate: async (move) => {
      if (!projectKey) return { snapshots: [] };
      await qc.cancelQueries({ queryKey: qk.documentListsForProject(projectKey) });
      const snapshots = qc.getQueriesData<ProjectDocumentSummary[]>({
        queryKey: qk.documentListsForProject(projectKey),
      });
      qc.setQueriesData<ProjectDocumentSummary[]>(
        { queryKey: qk.documentListsForProject(projectKey) },
        (previous) => (previous ? applyOptimisticDocumentMove(previous, move) : previous),
      );
      return { snapshots };
    },
    onError: (_error, _variables, context) => {
      for (const [queryKey, data] of context?.snapshots ?? []) qc.setQueryData(queryKey, data);
    },
    onSuccess: (document) => {
      if (!projectKey) return;
      qc.setQueryData<ProjectDocument>(qk.document(projectKey, document.id), document);
    },
    onSettled: (_document, error) => {
      // Keep the complete optimistic sibling projection while the canonical
      // list refetches. A failed refetch therefore cannot reintroduce stale
      // sibling positions, while mutation failures still use the snapshot
      // rollback above.
      if (projectKey && !error) invalidateLists(qc, projectKey);
    },
  });
}

export function useDeleteDocument(projectKey: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ documentId, version }: { documentId: number; version: number }) =>
      deleteDocument(projectKey!, documentId, version),
    onSuccess: (_result, { documentId }) => {
      if (!projectKey) return;
      qc.removeQueries({ queryKey: qk.document(projectKey, documentId) });
      invalidateLists(qc, projectKey);
    },
  });
}
