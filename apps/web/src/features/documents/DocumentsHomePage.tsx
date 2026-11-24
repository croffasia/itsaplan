'use client';

import { usePermissions } from '@/hooks/usePermissions';
import { useShellRoute } from '@/hooks/useShellRoute';
import DocumentsHome from './components/home/DocumentsHome';
import { useDocumentCreate } from './hooks/useDocumentCreate';
import { useDocumentsQuery } from './services/documents.service';

export default function DocumentsHomePage() {
  const projectKey = useShellRoute().projectKey ?? '';
  const { can } = usePermissions();
  const documents = useDocumentsQuery(projectKey);
  const { create, upload, creating } = useDocumentCreate(projectKey);

  return (
    <DocumentsHome
      projectKey={projectKey}
      documents={documents.data ?? []}
      loading={documents.isLoading}
      canCreate={can('documents', 'create')}
      creating={creating}
      onCreate={() => void create({ parentId: null, isPrivate: false })}
      onUpload={(file) => void upload(file)}
    />
  );
}
