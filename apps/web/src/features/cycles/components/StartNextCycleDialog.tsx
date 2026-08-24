import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import type { Cycle } from '@/lib/api';
import { formatShortDate } from '@/utils/dates';
import { unfinishedCount } from '@/utils/progress';
import { useStartNextCycle } from '@/services/cycles.service';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';

// Confirm finishing the running cycle and starting the next one today. The unfinished
// issues come along; the next cycle keeps its planned end date, so it runs longer.
export default function StartNextCycleDialog({
  cycle,
  next,
  projectKey,
  onClose,
}: {
  cycle: Cycle;
  next: Cycle;
  projectKey: string;
  onClose: () => void;
}) {
  const t = useTranslations('cycles.startNext');
  const startNext = useStartNextCycle(projectKey);

  return (
    <ConfirmDialog
      title={t('title')}
      confirmLabel={t('submit')}
      onConfirm={async () => {
        const { moved } = await startNext.mutateAsync(cycle.id);
        toast.success(t('started', { cycle: next.name, count: moved }));
        onClose();
      }}
      onClose={onClose}
    >
      <p className="text-sm text-muted-foreground">
        {t('description', {
          cycle: cycle.name,
          next: next.name,
          date: formatShortDate(next.endDate),
          count: unfinishedCount(cycle.progress),
        })}
      </p>
    </ConfirmDialog>
  );
}
