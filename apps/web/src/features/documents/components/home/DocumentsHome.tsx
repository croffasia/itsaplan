'use client';

import { useTranslations } from 'next-intl';
import { useShell } from '@/context/shellContext';
import type { ProjectDocumentSummary } from '@/lib/api/endpoints/documents';
import DocumentTopBar from '../DocumentTopBar';
import DocumentsCrumbs from '../DocumentsCrumbs';
import DocumentsHomeEmpty from './DocumentsHomeEmpty';
import DocumentsHomeForYou from './DocumentsHomeForYou';
import DocumentsHomeHeader from './DocumentsHomeHeader';
import DocumentsHomeLoading from './DocumentsHomeLoading';
import DocumentsHomePinned from './DocumentsHomePinned';
import DocumentsHomeRecent from './DocumentsHomeRecent';

export default function DocumentsHome({
  projectKey,
  documents,
  loading,
  canCreate,
  creating,
  onCreate,
  onUpload,
}: {
  projectKey: string;
  documents: ProjectDocumentSummary[];
  loading: boolean;
  canCreate: boolean;
  creating: boolean;
  onCreate: () => void;
  onUpload: (file: File) => void;
}) {
  const t = useTranslations('documents');
  const projectName = useShell().project?.project.name ?? '';

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <DocumentTopBar>
        <DocumentsCrumbs projectKey={projectKey} />
      </DocumentTopBar>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="flex flex-col gap-10 px-[clamp(16px,2.5vw,32px)] pt-8 pb-24 max-md:gap-8 max-md:pt-6">
          {loading ? (
            <DocumentsHomeLoading />
          ) : documents.length === 0 ? (
            <DocumentsHomeEmpty
              projectKey={projectKey}
              projectName={projectName}
              canCreate={canCreate}
              creating={creating}
              onCreate={onCreate}
              onUpload={onUpload}
            />
          ) : (
            <>
              <DocumentsHomeHeader
                subtitle={t('home.pageCount', { count: documents.length, project: projectName })}
                actions={canCreate ? { creating, onCreate, onUpload } : undefined}
              />
              <DocumentsHomeForYou projectKey={projectKey} />
              <DocumentsHomePinned projectKey={projectKey} documents={documents} />
              <DocumentsHomeRecent projectKey={projectKey} documents={documents} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
