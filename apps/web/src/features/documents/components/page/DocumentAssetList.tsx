import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import type { DocumentAsset } from '@/lib/api/endpoints/documents';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import DocumentAssetRow from './DocumentAssetRow';
import DocumentAssetThumbnail from './DocumentAssetThumbnail';

const hint =
  'rounded-md p-4 text-center text-sm text-muted-foreground outline-1 -outline-offset-1 outline-input outline-dashed';

// The page's files: images as thumbnails, other files as rows, or why there are none.
export default function DocumentAssetList({
  assets,
  loading,
  failed,
  emptyText,
  actions,
  onRetry,
}: {
  assets: DocumentAsset[];
  loading: boolean;
  failed: boolean;
  emptyText: string;
  actions: (asset: DocumentAsset) => ReactNode;
  onRetry: () => void;
}) {
  const t = useTranslations('documents');
  const images = assets.filter((asset) => asset.contentType.startsWith('image/'));
  const files = assets.filter((asset) => !asset.contentType.startsWith('image/'));

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-2" aria-hidden>
        <Skeleton className="aspect-[4/3] w-full rounded-lg" />
        <Skeleton className="aspect-[4/3] w-full rounded-lg" />
      </div>
    );
  }
  if (failed) {
    return (
      <p className={cn(hint, 'text-destructive outline-destructive/40')}>
        {t('assetsLoadFailed')}{' '}
        <Button type="button" variant="ghost" size="sm" className="h-7" onClick={onRetry}>
          {t('comments.retry')}
        </Button>
      </p>
    );
  }
  if (assets.length === 0) return <p className={hint}>{emptyText}</p>;
  return (
    <>
      {images.length > 0 && (
        <div className="mb-1 grid grid-cols-2 gap-2">
          {images.map((asset) => (
            <DocumentAssetThumbnail key={asset.id} asset={asset} actions={actions(asset)} />
          ))}
        </div>
      )}
      {files.map((asset) => (
        <DocumentAssetRow key={asset.id} asset={asset} actions={actions(asset)} />
      ))}
    </>
  );
}
