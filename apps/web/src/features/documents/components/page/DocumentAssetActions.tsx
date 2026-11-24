'use client';

import { CornerDownLeft, Link2, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { DocumentAsset } from '@/lib/api/endpoints/documents';
import { Button } from '@/components/ui/button';
import { copyText } from '@/utils/clipboard';

// Insert, copy the link to, and delete one asset of the page.
export default function DocumentAssetActions({
  asset,
  onInsert,
  onDelete,
}: {
  asset: DocumentAsset;
  onInsert?: () => void;
  onDelete?: () => void;
}) {
  const t = useTranslations('documents');
  const button = 'size-6.5 text-muted-foreground';

  const copy = async () => {
    if (await copyText(new URL(asset.url, window.location.origin).toString()))
      toast.success(t('assetLinkCopied'));
    else toast.error(t('blocks.copyFailed'));
  };

  return (
    <>
      {onInsert && (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className={button}
          aria-label={t('insertAsset', { name: asset.filename })}
          title={t('inspector.insertIntoPage')}
          onClick={onInsert}
        >
          <CornerDownLeft />
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className={button}
        aria-label={t('copyAssetLink', { name: asset.filename })}
        title={t('copyLink')}
        onClick={() => void copy()}
      >
        <Link2 />
      </Button>
      {onDelete && (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className={`${button} hover:text-destructive`}
          aria-label={t('deleteAsset', { name: asset.filename })}
          title={t('delete')}
          onClick={onDelete}
        >
          <Trash2 />
        </Button>
      )}
    </>
  );
}
