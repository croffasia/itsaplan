'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { ProjectDocumentSummary } from '@/lib/api/endpoints/documents';
import { useShell } from '@/context/shellContext';
import { titlePath, useDocumentTitle } from '@/hooks/useDocumentTitle';
import { usePermissions } from '@/hooks/usePermissions';
import { useShellRoute } from '@/hooks/useShellRoute';
import { useSession } from '@/lib/auth-client';
import { EmptyState } from '@/components/common/page/EmptyState';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import DocumentDeleteDialog from './components/DocumentDeleteDialog';
import DocumentTopBar from './components/DocumentTopBar';
import DocumentsArchiveRow from './components/archive/DocumentsArchiveRow';
import DocumentsArchiveTable from './components/archive/DocumentsArchiveTable';
import DocumentsCrumbs from './components/DocumentsCrumbs';
import DocumentsState from './components/DocumentsState';
import {
  useDeleteDocument,
  useDocumentsQuery,
  useRestoreDocument,
} from './services/documents.service';
import { managesDocument } from './utils/documentAccess';
import { documentAncestors } from './utils/documentTree';

export default function DocumentsArchivePage() {
  const t = useTranslations('documents');
  const projectKey = useShellRoute().projectKey ?? '';
  const { project } = useShell();
  const { can, isOwner } = usePermissions();
  const userId = useSession().data?.user.id ?? null;
  const archived = useDocumentsQuery(projectKey, '', true);
  const live = useDocumentsQuery(projectKey);
  const restore = useRestoreDocument(projectKey);
  const remove = useDeleteDocument(projectKey);
  const [deleting, setDeleting] = useState<ProjectDocumentSummary | null>(null);
  useDocumentTitle(titlePath(project?.project.name, t('archivedPages')));

  if (archived.isError) {
    return (
      <DocumentsState
        projectKey={projectKey}
        kind="failed"
        onRetry={() => void archived.refetch()}
      />
    );
  }

  const pages = [...(archived.data ?? [])].sort(
    (a, b) => Date.parse(b.archivedAt ?? '') - Date.parse(a.archivedAt ?? ''),
  );
  const all = [...(live.data ?? []), ...pages];
  const assignees = new Map((project?.assignees ?? []).map((person) => [person.userId, person]));
  const name = (document: ProjectDocumentSummary) => document.title.trim() || t('untitled');
  const canManage = (document: ProjectDocumentSummary) =>
    can('documents', 'delete') && managesDocument(document, userId, isOwner);
  const ref = (document: ProjectDocumentSummary) => ({
    documentId: document.id,
    version: document.version,
  });

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <DocumentTopBar>
        <DocumentsCrumbs projectKey={projectKey} current={t('archivedPages')} />
      </DocumentTopBar>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="slide-in-from-bottom-1.5 flex animate-in flex-col gap-10 px-[clamp(16px,2.5vw,32px)] pt-8 pb-24 fade-in-0 max-md:gap-8 max-md:pt-6">
          <header>
            <h1 className="text-[28px] leading-[1.15] font-semibold tracking-[-0.025em]">
              {t('archivedPages')}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{t('archiveDescription')}</p>
          </header>
          {archived.isLoading ? (
            <ListSkeleton rows={4} rowClassName="h-12" />
          ) : pages.length > 0 ? (
            <DocumentsArchiveTable>
              {pages.map((document) => (
                <DocumentsArchiveRow
                  key={document.id}
                  projectKey={projectKey}
                  document={document}
                  path={documentAncestors(document, all).map(name).join(' / ')}
                  archivedBy={
                    document.updatedByUserId ? assignees.get(document.updatedByUserId) : undefined
                  }
                  canManage={canManage(document)}
                  pending={restore.isPending || remove.isPending}
                  onRestore={() =>
                    restore.mutate(ref(document), {
                      onSuccess: () => toast.success(t('restoredPage', { title: name(document) })),
                    })
                  }
                  onDelete={() => setDeleting(document)}
                />
              ))}
            </DocumentsArchiveTable>
          ) : (
            <EmptyState title={t('noArchivedPages')} description={t('archiveDescription')} />
          )}
        </div>
      </div>
      {deleting && (
        <DocumentDeleteDialog
          title={name(deleting)}
          onClose={() => setDeleting(null)}
          onDelete={async () => {
            await remove.mutateAsync(ref(deleting));
            setDeleting(null);
            toast.success(t('deletedPage', { title: name(deleting) }));
          }}
        />
      )}
    </div>
  );
}
