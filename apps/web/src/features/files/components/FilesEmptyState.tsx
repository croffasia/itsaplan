import { FolderOpen } from 'lucide-react';
import type { StorageSettings } from '@/lib/api';
import { EmptyState } from '@/components/common/page/EmptyState';
import FilesUploadButton from './FilesUploadButton';

export default function FilesEmptyState({
  canUpload,
  limits,
  uploading,
  onFiles,
}: {
  canUpload: boolean;
  limits: StorageSettings | undefined;
  uploading: boolean;
  onFiles: (files: FileList) => void;
}) {
  return (
    <EmptyState
      title="No files yet"
      description="Upload documents and other important files for this project."
    >
      <FolderOpen className="mb-1 size-8 text-muted-foreground" />
      {canUpload && <FilesUploadButton limits={limits} uploading={uploading} onFiles={onFiles} />}
    </EmptyState>
  );
}
