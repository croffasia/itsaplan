'use client';

import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { DocumentAsset } from '@/lib/api/endpoints/documents';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';
import { useDeleteDocumentAsset } from '../../services/documents.service';

export default function DocumentAssetDeleteDialog({
  projectKey,
  documentId,
  asset,
  onClose,
}: {
  projectKey: string;
  documentId: number;
  asset: DocumentAsset;
  onClose: () => void;
}) {
  const t = useTranslations('documents');
  const tCommon = useTranslations('common');
  const remove = useDeleteDocumentAsset(projectKey, documentId);
  return (
    <ConfirmDialog
      title={t('inspector.deleteAssetTitle')}
      confirmLabel={tCommon('delete')}
      onConfirm={async () => {
        await remove.mutateAsync(asset.id);
        toast.success(t('inspector.assetDeleted', { name: asset.filename }));
        onClose();
      }}
      onClose={onClose}
    >
      <p className="text-sm text-muted-foreground">
        {t('deleteAssetConfirm', { name: asset.filename })}
      </p>
    </ConfirmDialog>
  );
}
