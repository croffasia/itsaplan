import type { AgentSchedule } from '@/lib/api';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SettingsScheduleRow } from './SettingsScheduleRow';

interface SettingsSchedulesTableProps {
  schedules: AgentSchedule[];
  runningId: number | null;
  onToggle: (schedule: AgentSchedule) => void;
  onRun: (scheduleId: number) => void;
  onHistory: (schedule: AgentSchedule) => void;
  onEdit: (scheduleId: number) => void;
  onDelete: (schedule: AgentSchedule) => void;
}

export function SettingsSchedulesTable({
  schedules,
  runningId,
  onToggle,
  onRun,
  onHistory,
  onEdit,
  onDelete,
}: SettingsSchedulesTableProps) {
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
          <TableHead className="text-xs font-medium text-muted-foreground">Task</TableHead>
          <TableHead className="text-xs font-medium text-muted-foreground">Schedule</TableHead>
          <TableHead className="text-xs font-medium text-muted-foreground">Next run</TableHead>
          <TableHead className="text-xs font-medium text-muted-foreground">Last run</TableHead>
          <TableHead className="text-right text-xs font-medium text-muted-foreground">
            Actions
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
            onHistory={() => onHistory(schedule)}
            onEdit={() => onEdit(schedule.id)}
            onDelete={() => onDelete(schedule)}
          />
        ))}
      </TableBody>
    </Table>
  );
}
