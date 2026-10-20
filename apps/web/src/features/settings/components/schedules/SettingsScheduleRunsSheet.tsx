import type { AgentSchedule } from '@/lib/api/endpoints/agentSchedules';
import {
  useAgentScheduleRuns,
  useCancelAgentScheduleRuns,
} from '@/services/agentSchedules.service';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useSettingsCan } from '../../context/settingsPermission';
import { useScheduleTypeName } from '../../hooks/useScheduleTypeName';
import { formatUtc, parseScheduleInput } from '../../utils/cronSchedule';
import { SettingsScheduleRunRow } from './SettingsScheduleRunRow';
import { useTranslations } from 'next-intl';

export function SettingsScheduleRunsSheet({
  projectKey,
  schedule,
  columnName,
  onClose,
}: {
  projectKey: string;
  schedule: AgentSchedule | null;
  columnName: string | null;
  onClose: () => void;
}) {
  const t = useTranslations('settings.schedules');
  const can = useSettingsCan();
  const query = useAgentScheduleRuns(projectKey, schedule?.id ?? null);
  const cancelRuns = useCancelAgentScheduleRuns(projectKey);
  const canCancel = can('edit') && schedule?.canTrigger === true;
  const runs = query.data ?? [];
  const typeName = useScheduleTypeName();
  // A type the hosted build added, which starts when its trigger fires.
  const addedType = schedule && !schedule.cron && schedule.type !== 'status' ? schedule.type : null;
  let when = t('entersColumn', { column: columnName ?? '' });
  if (schedule?.cron) {
    const parsed = parseScheduleInput(schedule.cron);
    when = parsed.ok ? parsed.description : schedule.cron;
  } else if (addedType) {
    when = typeName(addedType);
  }
  const delayMin = Math.round((schedule?.delaySec ?? 0) / 60);
  let nextRun = t('startsAtOnce');
  if (schedule?.nextRunAt) nextRun = `${t('nextRun')}: ${formatUtc(schedule.nextRunAt)}`;
  else if (addedType) nextRun = t('nextRunOnTrigger');
  else if (delayMin > 0) nextRun = t('startsAfter', { minutes: delayMin });

  function cancel(runId?: number) {
    if (schedule) cancelRuns.mutate({ scheduleId: schedule.id, runId });
  }

  // A claim stamps startedAt, so a started run can no longer be canceled.
  const groups = [
    {
      key: 'pending',
      title: t('pendingGroup'),
      runs: runs.filter((r) => r.status === 'pending' && !r.startedAt),
    },
    {
      key: 'running',
      title: t('runningGroup'),
      runs: runs.filter((r) => r.status === 'pending' && r.startedAt),
    },
    {
      key: 'completed',
      title: t('completedGroup'),
      runs: runs.filter((r) => r.status !== 'pending'),
    },
  ].filter((group) => group.runs.length > 0);
  return (
    <Sheet open={schedule != null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b bg-muted/30">
          <div className="flex min-w-0 items-center gap-2">
            <Badge
              variant={schedule?.status === 'active' ? 'secondary' : 'outline'}
              className="shrink-0 px-1.5 py-0 text-[10px] font-medium"
            >
              {t(schedule?.status === 'active' ? 'statusActive' : 'statusPaused')}
            </Badge>
            <SheetTitle className="truncate text-base">{schedule?.name}</SheetTitle>
          </div>
          <SheetDescription className="flex flex-wrap items-center gap-x-2 text-xs">
            <span>{when}</span>
            <span>·</span>
            <span className="tabular-nums">{nextRun}</span>
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {query.isLoading ? (
            <ListSkeleton rows={4} className="p-4" rowClassName="h-12" />
          ) : groups.length ? (
            groups.map((group) => (
              <div key={group.key}>
                <div className="flex items-center gap-2 bg-muted/50 px-4 py-1.5">
                  <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                    {group.title}
                  </p>
                  {group.key === 'pending' && canCancel && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="ms-auto h-6 text-xs"
                      disabled={cancelRuns.isPending}
                      onClick={() => cancel()}
                    >
                      <span>
                        {t('stopAllPending')}
                        <sup className="ms-0.5 text-[9px] tabular-nums">{group.runs.length}</sup>
                      </span>
                    </Button>
                  )}
                </div>
                <div className="divide-y divide-border/50">
                  {group.runs.map((run) => (
                    <SettingsScheduleRunRow
                      key={run.id}
                      run={run}
                      canceling={cancelRuns.isPending && cancelRuns.variables?.runId === run.id}
                      onCancel={
                        group.key === 'pending' && canCancel ? () => cancel(run.id) : undefined
                      }
                    />
                  ))}
                </div>
              </div>
            ))
          ) : (
            <p className="p-4 text-sm text-muted-foreground">{t('noRuns')}</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
