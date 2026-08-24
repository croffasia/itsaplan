import { useTranslations } from 'next-intl';
import type { Cycle } from '@/lib/api';
import { formatShortDate } from '@/utils/dates';
import { unfinishedCount } from '@/utils/progress';
import { useFinishCycle } from '@/services/cycles.service';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';

// Confirm closing a running cycle ahead of its planned end date. The issues stay on
// it, so the caller offers the transfer dialog once this one is through.
export default function FinishCycleDialog({
  cycle,
  projectKey,
  onClose,
  onFinished,
}: {
  cycle: Cycle;
  projectKey: string;
  onClose: () => void;
  onFinished: () => void;
}) {
  const t = useTranslations('cycles.finish');
  const finish = useFinishCycle(projectKey);

  return (
    <ConfirmDialog
      title={t('title')}
      confirmLabel={t('submit')}
      onConfirm={async () => {
        await finish.mutateAsync(cycle.id);
        onClose();
        onFinished();
      }}
      onClose={onClose}
    >
      <p className="text-sm text-muted-foreground">
        {t('description', {
          cycle: cycle.name,
          date: formatShortDate(cycle.endDate),
          count: unfinishedCount(cycle.progress),
        })}
      </p>
    </ConfirmDialog>
  );
}
