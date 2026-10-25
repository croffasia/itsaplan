'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useShell } from '@/context/shellContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useLiveRefresh } from '@/hooks/useLiveRefresh';
import { ApiError } from '@/lib/api/core/client';
import { qk } from '@/services/queryKeys';
import { documentPath } from '@/utils/paths';
import { revScope } from '@/utils/revScopes';
import {
  useCreateDocument,
  useDeleteDocument,
  useDocumentQuery,
  useDocumentsQuery,
  useDuplicateDocument,
} from '../services/documents.service';
import { documentAncestors } from '../utils/documentTree';
import DocumentEditor from './DocumentEditor';
import DocumentLoadError from './DocumentLoadError';
import DocumentLoadingState from './DocumentLoadingState';

// One document in its editor, loaded by id: the documents page shows it, and so does
// the inbox beside a notification about it. A page it creates or copies opens on the
// documents page.
export default function DocumentView({
  projectKey,
  documentId,
  defaultCommentsOpen,
  onBack,
  onCreated,
  onDeleted,
}: {
  projectKey: string;
  documentId: number;
  defaultCommentsOpen?: boolean;
  onBack?: () => void;
  onCreated?: () => void;
  onDeleted: () => void;
}) {
  const t = useTranslations('documents');
  const router = useRouter();
  const { project } = useShell();
  const { can, isOwner } = usePermissions();
  const documentQuery = useDocumentQuery(projectKey, documentId);
  const allDocumentsQuery = useDocumentsQuery(projectKey);
  const allArchivedDocumentsQuery = useDocumentsQuery(projectKey, '', true);
  const createDocument = useCreateDocument(projectKey);
  const deleteDocument = useDeleteDocument(projectKey);
  const duplicateDocument = useDuplicateDocument(projectKey);
  const canEdit = can('documents', 'edit');

  useLiveRefresh({
    scope: project ? revScope.documents(project.project.id) : null,
    targets: [
      qk.documentListsForProject(projectKey),
      qk.document(projectKey, documentId),
      qk.documentRevisions(projectKey, documentId),
      qk.documentAssets(projectKey, documentId),
      qk.documentComments(projectKey, documentId),
      qk.documentIssueLinks(projectKey, documentId),
    ],
  });

  const document = documentQuery.data;
  if (documentQuery.error instanceof ApiError && documentQuery.error.status === 404) {
    return (
      <main className="flex min-w-0 flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
        {t('pageNotFound')}
      </main>
    );
  }
  if (documentQuery.isError) {
    return <DocumentLoadError onRetry={() => void documentQuery.refetch()} />;
  }
  if (!project || !document) return <DocumentLoadingState />;

  const assignees = project.assignees;
  const authorNames = Object.fromEntries(assignees.map((a) => [a.userId, a.name]));
  const create = async (parentId: number | null, isPrivate: boolean) => {
    try {
      const created = await createDocument.mutateAsync({ parentId, isPrivate });
      onCreated?.();
      router.push(documentPath(projectKey, created.id));
    } catch {
      // Mutation errors are reported by the shared query client.
    }
  };
  const duplicate = async (title: string, version: number) => {
    try {
      const copy = await duplicateDocument.mutateAsync({
        documentId: document.id,
        version,
        title: t('copyTitle', { title: title.trim() || t('untitled') }),
        parentId: document.parentId,
      });
      router.push(documentPath(projectKey, copy.id));
    } catch {
      // Mutation errors are reported by the shared query client.
    }
  };

  return (
    <DocumentEditor
      key={document.id}
      projectKey={projectKey}
      projectName={project.project.name}
      document={document}
      ancestors={documentAncestors(document, [
        ...(allDocumentsQuery.data ?? []),
        ...(allArchivedDocumentsQuery.data ?? []),
      ])}
      documents={allDocumentsQuery.data ?? []}
      authorName={
        assignees.find((candidate) => candidate.userId === document.updatedByUserId)?.name ?? null
      }
      authorNames={authorNames}
      canEdit={canEdit}
      canReadWorkItems={can('work_items', 'read')}
      canLinkWorkItems={canEdit && can('work_items', 'edit')}
      isProjectOwner={isOwner}
      canCreate={can('documents', 'create')}
      canDelete={can('documents', 'delete')}
      defaultCommentsOpen={defaultCommentsOpen}
      onBack={onBack}
      onCreate={(parentId, isPrivate) => void create(parentId, isPrivate)}
      onDuplicate={duplicate}
      onDelete={async (version) => {
        await deleteDocument.mutateAsync({ documentId: document.id, version });
        onDeleted();
      }}
      onReload={async () => {
        const result = await documentQuery.refetch();
        if (result.isError) throw result.error;
        return result.data ?? null;
      }}
    />
  );
}
