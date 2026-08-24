import { useTranslations } from 'next-intl';
import type { Cycle } from '@/lib/api';
import { useDeleteCycle } from '@/services/cycles.service';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';

// Confirm deleting a cycle. The issues it holds are not deleted with it — they stay
// in the project without a cycle.
export default function DeleteCycleDialog({
  cycle,
  projectKey,
  onClose,
  onDeleted,
}: {
  cycle: Cycle;
  projectKey: string;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const t = useTranslations('cycles.delete');
  const tCommon = useTranslations('common');
  const del = useDeleteCycle(projectKey);

  return (
    <ConfirmDialog
      title={t('title')}
      confirmLabel={tCommon('delete')}
      onConfirm={async () => {
        await del.mutateAsync(cycle.id);
        onClose();
        onDeleted();
      }}
      onClose={onClose}
    >
      <p className="text-sm text-muted-foreground">
        {t('description', { cycle: cycle.name, count: cycle.progress.total })}
      </p>
    </ConfirmDialog>
  );
}
