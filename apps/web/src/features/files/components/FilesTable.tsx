import type { ProjectFile } from '@/lib/api';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import FilesTableRow from './FilesTableRow';

export default function FilesTable({
  files,
  canDelete,
  downloadingId,
  onDownload,
  onPreview,
  onDelete,
}: {
  files: ProjectFile[];
  canDelete: boolean;
  downloadingId: string | null;
  onDownload: (file: ProjectFile) => void;
  onPreview: (file: ProjectFile) => void;
  onDelete: (file: ProjectFile) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Table className="min-w-[760px] table-fixed">
        <colgroup>
          <col className="w-[40%]" />
          <col className="w-[12%]" />
          <col className="w-[18%]" />
          <col className="w-[20%]" />
          <col className="w-[10%]" />
        </colgroup>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="px-3 text-xs text-muted-foreground">Name</TableHead>
            <TableHead className="text-xs text-muted-foreground">Size</TableHead>
            <TableHead className="text-xs text-muted-foreground">Uploaded by</TableHead>
            <TableHead className="text-xs text-muted-foreground">Uploaded</TableHead>
            <TableHead className="px-3 text-right text-xs text-muted-foreground">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {files.map((file) => (
            <FilesTableRow
              key={file.id}
              file={file}
              canDelete={canDelete}
              downloading={downloadingId === file.id}
              onDownload={() => onDownload(file)}
              onPreview={() => onPreview(file)}
              onDelete={() => onDelete(file)}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
