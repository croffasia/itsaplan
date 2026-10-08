import type { AgentSchedule } from '@/lib/api/endpoints/agentSchedules';
import { parseScheduleInput } from '../../utils/cronSchedule';
import { useTranslations } from 'next-intl';

// When a schedule runs: its cron in words, or the column whose incoming issues start it.
export function SettingsScheduleWhen({
  schedule,
  columnName,
}: {
  schedule: AgentSchedule;
  columnName: string | null;
}) {
  const t = useTranslations('settings.schedules');
  if (schedule.cron === null) {
    const minutes = Math.round(schedule.delaySec / 60);
    return (
      <>
        <p className="text-sm">{t('entersColumn', { column: columnName ?? '' })}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {minutes > 0 ? t('startsAfter', { minutes }) : t('startsAtOnce')}
        </p>
      </>
    );
  }
  const parsed = parseScheduleInput(schedule.cron);
  return (
    <>
      <p className="text-sm" title={schedule.cron}>
        {parsed.ok ? parsed.description : schedule.cron}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">UTC</p>
    </>
  );
}
