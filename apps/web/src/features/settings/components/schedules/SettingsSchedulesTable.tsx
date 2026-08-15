import type { AgentSchedule } from '@/lib/api';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SettingsScheduleRow } from './SettingsScheduleRow';
import { useTranslations } from 'next-intl';

interface SettingsSchedulesTableProps {
  schedules: AgentSchedule[];
  runningId: number | null;
  onToggle: (schedule: AgentSchedule) => void;
  onRun: (scheduleId: number) => void;
  onCancelPending: (scheduleId: number) => void;
  onHistory: (schedule: AgentSchedule) => void;
  onEdit: (scheduleId: number) => void;
  onDelete: (schedule: AgentSchedule) => void;
}

export function SettingsSchedulesTable({
  schedules,
  runningId,
  onToggle,
  onRun,
  onCancelPending,
  onHistory,
  onEdit,
  onDelete,
}: SettingsSchedulesTableProps) {
  const t = useTranslations('settings.schedules');
  const tCommon = useTranslations('common');
  return (
    <Table className="min-w-[960px] table-fixed">
      <colgroup>
        <col className="w-[30%]" />
        <col className="w-[18%]" />
        <col className="w-[20%]" />
        <col className="w-[18%]" />
        <col className="w-[14%]" />
      </colgroup>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="text-xs font-medium text-muted-foreground">{t('task')}</TableHead>
          <TableHead className="text-xs font-medium text-muted-foreground">
            {t('schedule')}
          </TableHead>
          <TableHead className="text-xs font-medium text-muted-foreground">
            {t('nextRun')}
          </TableHead>
          <TableHead className="text-xs font-medium text-muted-foreground">
            {t('lastRun')}
          </TableHead>
          <TableHead className="text-right text-xs font-medium text-muted-foreground">
            {tCommon('actions')}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {schedules.map((schedule) => (
          <SettingsScheduleRow
            key={schedule.id}
            schedule={schedule}
            running={runningId === schedule.id}
            onToggle={() => onToggle(schedule)}
            onRun={() => onRun(schedule.id)}
            onCancelPending={() => onCancelPending(schedule.id)}
            onHistory={() => onHistory(schedule)}
            onEdit={() => onEdit(schedule.id)}
            onDelete={() => onDelete(schedule)}
          />
        ))}
      </TableBody>
    </Table>
  );
}
