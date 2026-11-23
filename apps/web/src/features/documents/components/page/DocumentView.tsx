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
} from '../../services/documents.service';
import { documentAncestors } from '../../utils/documentTree';
import DocumentBreadcrumbs from './DocumentBreadcrumbs';
import DocumentEditor from './DocumentEditor';
import DocumentLoadError from './DocumentLoadError';
import DocumentLoadingState from '../DocumentLoadingState';
import DocumentTopBar from '../DocumentTopBar';

// One document in its editor, loaded by id: the documents page shows it, and so does
// the inbox beside a notification about it. A page it creates or copies opens on the
// documents page.
export default function DocumentView({
  projectKey,
  documentId,
  commentId,
  onBack,
  onCreated,
  onDeleted,
}: {
  projectKey: string;
  documentId: number;
  commentId?: string | null;
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

  const create = async (parentId: number | null, isPrivate: boolean) => {
    try {
      const created = await createDocument.mutateAsync({ parentId, isPrivate });
      onCreated?.();
      router.push(documentPath(projectKey, created.id));
    } catch {
      // Mutation errors are reported by the shared query client.
    }
  };

  const document = documentQuery.data;
  if (documentQuery.isError || !project || !document) {
    return (
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
        <DocumentTopBar>
          <DocumentBreadcrumbs
            projectKey={projectKey}
            projectName={project?.project.name}
            documents={allDocumentsQuery.data ?? []}
            canCreate={can('documents', 'create')}
            loading={!documentQuery.isError}
            onCreate={(parentId, isPrivate) => void create(parentId, isPrivate)}
          />
        </DocumentTopBar>
        {documentQuery.isError ? (
          <DocumentLoadError
            projectKey={projectKey}
            notFound={documentQuery.error instanceof ApiError && documentQuery.error.status === 404}
            onRetry={() => void documentQuery.refetch()}
          />
        ) : (
          <DocumentLoadingState />
        )}
      </main>
    );
  }

  const assignees = project.assignees;
  const authorNames = Object.fromEntries(assignees.map((a) => [a.userId, a.name]));
  const owner = assignees.find((candidate) => candidate.userId === document.ownerUserId);
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
      owner={owner ? { name: owner.name, image: owner.image } : null}
      authorNames={authorNames}
      canEdit={canEdit}
      canShare={canEdit}
      sharingEnabled={project.sharingEnabled}
      canReadWorkItems={can('work_items', 'read')}
      canLinkWorkItems={canEdit && can('work_items', 'edit')}
      isProjectOwner={isOwner}
      canCreate={can('documents', 'create')}
      canDelete={can('documents', 'delete')}
      commentId={commentId}
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
