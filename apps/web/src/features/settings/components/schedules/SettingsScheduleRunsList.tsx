import { useTranslations } from 'next-intl';
import type { AgentScheduleRun } from '@/lib/api/endpoints/agentSchedules';
import { Button } from '@/components/ui/button';
import { SettingsScheduleRunRow } from './SettingsScheduleRunRow';

export default function SettingsScheduleRunsList({
  runs,
  canCancel,
  canceling,
  onCancel,
}: {
  runs: AgentScheduleRun[];
  canCancel: boolean;
  canceling: boolean;
  onCancel: (runId?: number) => void;
}) {
  const t = useTranslations('settings.schedules');
  const groups = [
    {
      key: 'pending',
      title: t('pendingGroup'),
      runs: runs.filter((run) => run.executionState === 'queued'),
    },
    {
      key: 'running',
      title: t('runningGroup'),
      runs: runs.filter((run) => run.executionState === 'running'),
    },
    {
      key: 'completed',
      title: t('completedGroup'),
      runs: runs.filter((run) => run.status !== 'pending'),
    },
  ].filter((group) => group.runs.length > 0);
  if (!groups.length) return <p className="p-4 text-sm text-muted-foreground">{t('noRuns')}</p>;
  return (
    <>
      {groups.map((group) => {
        // Cancellation is limited to runs that have never been claimed.
        const cancelable = group.runs.filter((run) => !run.startedAt).length;
        return (
          <div key={group.key}>
            <div className="flex items-center gap-2 bg-muted/50 px-4 py-1.5">
              <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                {group.title}
              </p>
              {group.key === 'pending' && canCancel && cancelable > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="ms-auto h-6 text-xs"
                  disabled={canceling}
                  onClick={() => onCancel()}
                >
                  <span>
                    {t('stopAllPending')}
                    <sup className="ms-0.5 text-[9px] tabular-nums">{cancelable}</sup>
                  </span>
                </Button>
              )}
            </div>
            <div className="divide-y divide-border/50">
              {group.runs.map((run) => (
                <SettingsScheduleRunRow
                  key={run.id}
                  run={run}
                  canceling={canceling}
                  onCancel={
                    group.key === 'pending' && !run.startedAt && canCancel
                      ? () => onCancel(run.id)
                      : undefined
                  }
                />
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}
