import { Download, Trash2 } from 'lucide-react';
import type { ProjectFile } from '@/lib/api';
import { formatDateTime } from '@/utils/dates';
import { formatFileSize } from '@/utils/fileSize';
import { fileIcon } from '@/utils/fileIcon';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';

export default function FilesTableRow({
  file,
  canDelete,
  downloading,
  onDownload,
  onDelete,
}: {
  file: ProjectFile;
  canDelete: boolean;
  downloading: boolean;
  onDownload: () => void;
  onDelete: () => void;
}) {
  const Icon = fileIcon(file.contentType);
  return (
    <TableRow>
      <TableCell className="px-3 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <Icon className="size-4" />
          </span>
          <span className="truncate font-medium" title={file.filename}>
            {file.filename}
          </span>
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground">{formatFileSize(file.sizeBytes)}</TableCell>
      <TableCell className="text-muted-foreground">
        <span className="block truncate">{file.uploadedByName ?? 'Former member'}</span>
      </TableCell>
      <TableCell className="text-muted-foreground">{formatDateTime(file.createdAt)}</TableCell>
      <TableCell className="px-3">
        <div className="flex justify-end gap-1">
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
