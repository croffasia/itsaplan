'use client';

import { Search } from 'lucide-react';
import { useShell } from '@/context/shellContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useStorageSettingsQuery } from '@/services/storage.service';
import SectionPageView from '@/components/common/page/SectionPageView';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import FilesDropOverlay from './components/FilesDropOverlay';
import FilesEmptyState from './components/FilesEmptyState';
import FilesTable from './components/FilesTable';
import FilesUploadButton from './components/FilesUploadButton';
import { useFilesPage } from './hooks/useFilesPage';

export default function FilesPage() {
  const { project } = useShell();
  const { can } = usePermissions();
  const projectKey = project?.project.key ?? '';
  const limits = useStorageSettingsQuery().data;
  const model = useFilesPage(projectKey, limits);
  const canUpload = can('files', 'create');

  if (!project || model.filesQuery.isLoading) {
    return <Skeleton className="m-6 flex-1" />;
  }
  if (!can('files', 'read')) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        You do not have access to files.
      </div>
    );
  }

  return (
    <div
      className="relative flex min-h-0 flex-1"
      {...(canUpload ? model.dragZone.dragHandlers : {})}
    >
      <SectionPageView
        title="Files"
        description="Important documents and files shared with this project."
        actions={
          canUpload ? (
            <FilesUploadButton
              limits={limits}
              uploading={model.uploadFile.isPending}
              onFiles={model.upload}
            />
          ) : undefined
        }
        wide
      >
        {(model.filesQuery.data?.length ?? 0) === 0 ? (
          <FilesEmptyState
            canUpload={canUpload}
            limits={limits}
            uploading={model.uploadFile.isPending}
            onFiles={model.upload}
          />
        ) : (
          <div className="space-y-4 pb-8">
            <div className="relative max-w-sm">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={model.search}
                placeholder="Search files…"
                className="pl-9"
                onChange={(event) => model.setSearch(event.target.value)}
              />
            </div>
            {model.files.length > 0 ? (
              <FilesTable
                files={model.files}
                canDelete={can('files', 'delete')}
                downloadingId={model.downloadingId}
                onDownload={model.download}
                onDelete={model.setTarget}
              />
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No files match your search.
              </p>
            )}
          </div>
        )}
      </SectionPageView>

      {model.dragZone.draggedFiles !== null && (
        <FilesDropOverlay count={model.dragZone.draggedFiles} />
      )}
      {model.target && (
        <ConfirmDialog
          title={`Delete ${model.target.filename}?`}
          confirmLabel="Delete file"
          onConfirm={model.deleteTarget}
          onClose={() => model.setTarget(null)}
        >
          <p className="text-sm text-muted-foreground">
            This file will be permanently removed for everyone in the project.
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}
