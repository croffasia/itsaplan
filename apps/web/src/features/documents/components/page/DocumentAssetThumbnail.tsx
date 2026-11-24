import type { ReactNode } from 'react';
import type { DocumentAsset } from '@/lib/api/endpoints/documents';
import { setEmbedDragData } from '@/components/common/editor/attachmentEmbed';
import { formatSize } from '@/utils/fileSize';

// An image asset of the page as a thumbnail card, its actions over the top corner.
export default function DocumentAssetThumbnail({
  asset,
  actions,
}: {
  asset: DocumentAsset;
  actions: ReactNode;
}) {
  return (
    // The card is the drag source, not the <img>: Chrome adds a dragged <img> to the drop as
    // a file, and the editor would upload it again as a new asset.
    <figure
      draggable
      onDragStart={(event) => setEmbedDragData(event.dataTransfer, asset)}
      className="group relative m-0 overflow-hidden rounded-lg bg-muted/70"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- protected assets cannot go through Next's public image optimizer. */}
      <img
        src={asset.url}
        alt=""
        draggable={false}
        className="block aspect-[4/3] w-full object-cover"
      />
      <figcaption className="flex min-w-0 items-baseline gap-1.5 px-2 pt-1.5 pb-2 text-xs">
        <span className="truncate font-medium" dir="auto">
          {asset.filename}
        </span>
        <span className="shrink-0 text-muted-foreground tabular-nums">
          {formatSize(asset.sizeBytes)}
        </span>
      </figcaption>
      <div className="absolute end-1.5 top-1.5 flex gap-0.5 rounded-md bg-popover p-0.5 shadow-[var(--overlay-shadow)] transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
        {actions}
      </div>
    </figure>
  );
}
