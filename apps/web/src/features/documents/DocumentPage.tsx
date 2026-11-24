'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useShell } from '@/context/shellContext';
import { useRecentDocuments } from '@/hooks/useDocumentNavigation';
import { titlePath, useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useShellRoute } from '@/hooks/useShellRoute';
import { ApiError } from '@/lib/api/core/client';
import { documentsArchivePath, documentsPath } from '@/utils/paths';
import DocumentView from './components/page/DocumentView';
import { useDocumentsSearch } from './hooks/useDocumentsSearch';
import { useDocumentQuery } from './services/documents.service';

// One page beside the Docs rail. A missing page, or an id that is not one, returns to Docs home.
export default function DocumentPage() {
  const t = useTranslations('documents');
  const router = useRouter();
  const { project } = useShell();
  const projectKey = useShellRoute().projectKey ?? '';
  const raw = Number(useParams<{ documentId: string }>().documentId);
  const documentId = Number.isSafeInteger(raw) && raw > 0 ? raw : null;
  const [, setSearch] = useDocumentsSearch(projectKey);
  const { visit } = useRecentDocuments(projectKey);
  const documentQuery = useDocumentQuery(projectKey, documentId);
  const notFound =
    documentId === null ||
    (documentQuery.error instanceof ApiError && documentQuery.error.status === 404);
  const document = documentQuery.isError ? undefined : documentQuery.data;
  useDocumentTitle(
    titlePath(project?.project.name, document && (document.title.trim() || t('untitled'))),
  );

  useEffect(() => {
    if (documentId !== null) visit(documentId);
  }, [documentId, visit]);

  useEffect(() => {
    if (notFound) router.replace(documentsPath(projectKey));
  }, [notFound, projectKey, router]);

  if (documentId === null) return null;
  return (
    <DocumentView
      key={documentId}
      projectKey={projectKey}
      documentId={documentId}
      onBack={() => router.push(documentsArchivePath(projectKey))}
      onCreated={() => setSearch('')}
      onDeleted={() => router.push(documentsArchivePath(projectKey))}
    />
  );
}
