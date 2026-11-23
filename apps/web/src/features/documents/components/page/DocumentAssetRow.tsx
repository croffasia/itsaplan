import type { ReactNode } from 'react';
import { FileText } from 'lucide-react';
import type { DocumentAsset } from '@/lib/api/endpoints/documents';
import { formatSize } from '@/utils/fileSize';

// A file asset of the page that is not an image, as one row.
export default function DocumentAssetRow({
  asset,
  actions,
}: {
  asset: DocumentAsset;
  actions: ReactNode;
}) {
  return (
    <div className="group -mx-2 flex min-h-9 items-center gap-2.5 rounded-md ps-2 pe-1 text-[13px] transition-colors hover:bg-accent">
      <span className="grid size-7 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
        <FileText className="size-3.5" />
      </span>
      <span className="min-w-0 flex-1 truncate" dir="auto">
        {asset.filename}
      </span>
      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
        {formatSize(asset.sizeBytes)}
      </span>
      <span className="flex transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
        {actions}
      </span>
    </div>
  );
}
