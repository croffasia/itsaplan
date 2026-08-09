import { Download, Eye, Trash2 } from 'lucide-react';
import type { ProjectFile } from '@/lib/api';
import { formatDateTime } from '@/utils/dates';
import { formatFileSize } from '@/utils/fileSize';
import { fileIcon } from '@/utils/fileIcon';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import { filePreviewType } from '../utils/filePreview';

export default function FilesTableRow({
  file,
  canDelete,
  downloading,
  onDownload,
  onPreview,
  onDelete,
}: {
  file: ProjectFile;
  canDelete: boolean;
  downloading: boolean;
  onDownload: () => void;
  onPreview: () => void;
  onDelete: () => void;
}) {
  const Icon = fileIcon(file.contentType);
  const previewable = filePreviewType(file) !== null;
  return (
    <TableRow>
      <TableCell className="px-3 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <Icon className="size-4" />
          </span>
          {previewable ? (
            <button
              type="button"
              className="truncate text-left font-medium hover:underline"
              title={`Preview ${file.filename}`}
              onClick={onPreview}
            >
              {file.filename}
            </button>
          ) : (
            <span className="truncate font-medium" title={file.filename}>
              {file.filename}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground">{formatFileSize(file.sizeBytes)}</TableCell>
      <TableCell className="text-muted-foreground">
        <span className="block truncate">{file.uploadedByName ?? 'Former member'}</span>
      </TableCell>
      <TableCell className="text-muted-foreground">{formatDateTime(file.createdAt)}</TableCell>
      <TableCell className="px-3">
        <div className="flex justify-end gap-1">
          {previewable && (
            <Button
              variant="ghost"
              size="icon-sm"
              title="Preview"
              aria-label={`Preview ${file.filename}`}
              onClick={onPreview}
            >
              <Eye />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={downloading}
            title="Download"
            aria-label={`Download ${file.filename}`}
            onClick={onDownload}
          >
            <Download />
          </Button>
          {canDelete && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-destructive"
              title="Delete"
              aria-label={`Delete ${file.filename}`}
              onClick={onDelete}
            >
              <Trash2 />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
