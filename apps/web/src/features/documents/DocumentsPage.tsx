'use client';

import { useDeferredValue, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useShell } from '@/context/shellContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useLiveRefresh } from '@/hooks/useLiveRefresh';
import { revScope } from '@/utils/revScopes';
import { qk } from '@/services/queryKeys';
import { documentsPath, documentPath } from '@/utils/paths';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api';
import {
  useCreateDocument,
  useDeleteDocument,
  useDuplicateDocument,
  useDocumentQuery,
  useDocumentsQuery,
} from './services/documents.service';
import DocumentEditor from './components/DocumentEditor';
import DocumentLoadError from './components/DocumentLoadError';
import DocumentLoadingState from './components/DocumentLoadingState';
import DocumentsIndex from './components/DocumentsIndex';
import { documentBelongsToTab, type DocumentListTab } from './utils/documentList';
import { documentAncestors } from './utils/documentTree';
import { useTranslations } from 'next-intl';

export default function DocumentsPage() {
  const { project } = useShell();
  const params = useParams<{ projectKey: string; documentId?: string }>();
  const router = useRouter();
  const t = useTranslations('documents');
  const { can, isOwner } = usePermissions();
  const projectKey = params.projectKey;
  const routeId = params.documentId ? Number(params.documentId) : null;
  const documentId = routeId && Number.isFinite(routeId) ? routeId : null;
  const [search, setSearch] = useState('');
  const [listTab, setListTab] = useState<DocumentListTab>('public');
  const deferredSearch = useDeferredValue(search.trim());
  const allDocumentsQuery = useDocumentsQuery(projectKey);
  const allArchivedDocumentsQuery = useDocumentsQuery(projectKey, '', true);
  const activeDocumentsQuery = useDocumentsQuery(projectKey, deferredSearch);
  const archivedDocumentsQuery = useDocumentsQuery(projectKey, deferredSearch, true);
  const visibleDocumentsQuery =
    listTab === 'archived' ? archivedDocumentsQuery : activeDocumentsQuery;
  const filteredDocuments = (visibleDocumentsQuery.data ?? []).filter((document) =>
    documentBelongsToTab(document, listTab),
  );
  const visibleIds = new Set(filteredDocuments.map((document) => document.id));
  const reorderSafe = filteredDocuments.every(
    (document) => document.parentId === null || visibleIds.has(document.parentId),
  );
  const visibleDocuments = filteredDocuments.map((document) =>
    document.parentId !== null && !visibleIds.has(document.parentId)
      ? { ...document, parentId: null }
      : document,
  );
  const documentQuery = useDocumentQuery(projectKey, documentId);
  const createDocument = useCreateDocument(projectKey);
  const deleteDocument = useDeleteDocument(projectKey);
  const duplicateDocument = useDuplicateDocument(projectKey);
  const canRead = can('documents', 'read');
  const canCreate = can('documents', 'create');
  const canEdit = can('documents', 'edit');
  const canDelete = can('documents', 'delete');
  const canReadWorkItems = can('work_items', 'read');
  const canLinkWorkItems = canEdit && can('work_items', 'edit');

  useLiveRefresh({
    scope: project ? revScope.documents(project.project.id) : null,
    targets: [
      qk.documentListsForProject(projectKey),
      ...(documentId === null
        ? []
        : [
            qk.document(projectKey, documentId),
            qk.documentRevisions(projectKey, documentId),
            qk.documentAssets(projectKey, documentId),
            qk.documentIssueLinks(projectKey, documentId),
          ]),
    ],
  });

  useEffect(() => {
    if (documentQuery.error instanceof ApiError && documentQuery.error.status === 404) {
      router.replace(documentsPath(projectKey));
    }
  }, [documentQuery.error, projectKey, router]);

  if (!project) {
    return (
      <div className="flex flex-1 gap-0 overflow-hidden">
        <Skeleton className="m-4 w-72" />
        <Skeleton className="m-4 flex-1" />
      </div>
    );
  }

  if (!canRead) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 text-center text-sm text-muted-foreground">
        {t('noAccess')}
      </div>
    );
  }

  const create = async (parentId: number | null, isPrivate = false) => {
    try {
      setSearch('');
      const newDocument = await createDocument.mutateAsync({ parentId, isPrivate });
      router.push(documentPath(projectKey, newDocument.id));
    } catch {
      // Mutation errors are reported by the shared query client.
    }
  };

  const remove = async (version: number) => {
    if (documentId === null) return;
    await deleteDocument.mutateAsync({ documentId, version });
    router.push(documentsPath(projectKey));
  };

  const duplicate = async (title: string, version: number) => {
    if (!activeDocument) return;
    try {
      const copy = await duplicateDocument.mutateAsync({
        documentId: activeDocument.id,
        version,
        title: t('copyTitle', { title: title.trim() || t('untitled') }),
        parentId: activeDocument.parentId,
      });
      router.push(documentPath(projectKey, copy.id));
    } catch {
      // Mutation errors are reported by the shared query client.
    }
  };

  const activeDocument = documentQuery.data;
  const author = activeDocument?.updatedByUserId
    ? project.assignees.find((candidate) => candidate.userId === activeDocument.updatedByUserId)
    : null;
  const ancestors = activeDocument
    ? documentAncestors(activeDocument, [
        ...(allDocumentsQuery.data ?? []),
        ...(allArchivedDocumentsQuery.data ?? []),
      ])
    : [];
  const detailFailed =
    documentId !== null &&
    documentQuery.isError &&
    !(documentQuery.error instanceof ApiError && documentQuery.error.status === 404);

  if (documentId === null) {
    return (
      <DocumentsIndex
        projectKey={projectKey}
        documents={visibleDocuments}
        tab={listTab}
        search={search}
        searching={deferredSearch.length > 0}
        loading={visibleDocumentsQuery.isLoading}
        failed={visibleDocumentsQuery.isError}
        canCreate={canCreate}
        canEdit={canEdit}
        authorNames={Object.fromEntries(
          project.assignees.map((candidate) => [candidate.userId, candidate.name]),
        )}
        reorderSafe={reorderSafe}
        creating={createDocument.isPending}
        onSearchChange={setSearch}
        onTabChange={setListTab}
        onCreate={(parentId) => void create(parentId, listTab === 'private')}
        onRetry={() => void visibleDocumentsQuery.refetch()}
      />
    );
  }

  if (detailFailed) return <DocumentLoadError onRetry={() => void documentQuery.refetch()} />;
  if (!activeDocument) return <DocumentLoadingState />;

  return (
    <DocumentEditor
      key={activeDocument.id}
      projectKey={projectKey}
      projectName={project.project.name}
      document={activeDocument}
      ancestors={ancestors}
      authorName={author?.name ?? null}
      authorNames={Object.fromEntries(
        project.assignees.map((candidate) => [candidate.userId, candidate.name]),
      )}
      canEdit={canEdit}
      canReadWorkItems={canReadWorkItems}
      canLinkWorkItems={canLinkWorkItems}
      isProjectOwner={isOwner}
      canCreate={canCreate}
      canDelete={canDelete}
      onBack={() => router.push(documentsPath(projectKey))}
      onCreateChild={() => void create(activeDocument.id, activeDocument.isPrivate)}
      onDuplicate={duplicate}
      onDelete={remove}
      onReload={async () => {
        const result = await documentQuery.refetch();
        if (result.isError) throw result.error;
        return result.data ?? null;
      }}
    />
  );
}
