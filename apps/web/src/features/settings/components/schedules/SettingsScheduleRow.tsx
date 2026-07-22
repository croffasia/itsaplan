import {
  Bot,
  History,
  MessageSquareText,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  RotateCw,
  Trash2,
  Zap,
} from 'lucide-react';
import type { AgentSchedule } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TableCell, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import SettingsIconButton from '../SettingsIconButton';
import { useSettingsCan } from '../../context/settingsPermission';
import { parseScheduleInput } from '../../utils/cronSchedule';

export function SettingsScheduleRow({
  schedule,
  running,
  onToggle,
  onRun,
  onHistory,
  onEdit,
  onDelete,
}: {
  schedule: AgentSchedule;
  running: boolean;
  onToggle: () => void;
  onRun: () => void;
  onHistory: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const can = useSettingsCan();
  const parsedSchedule = parseScheduleInput(schedule.cron);
  const scheduleDescription = parsedSchedule.ok ? parsedSchedule.description : schedule.cron;
  return (
    <TableRow className="group/item cursor-pointer" onClick={onHistory}>
      <TableCell className="px-3 py-4 align-top whitespace-normal">
        <div className="flex min-w-0 items-start gap-2.5">
          <span
            className={cn('mt-[7px] size-2 shrink-0 rounded-full', statusDotClass(schedule.status))}
            title={schedule.status === 'active' ? 'Active' : 'Paused'}
          />
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MessageSquareText className="size-4" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>View task</TooltipContent>
            </Tooltip>
            <PopoverContent align="start" className="w-80">
              <p className="text-xs font-medium text-muted-foreground">Task</p>
              <p className="mt-1.5 text-sm whitespace-pre-wrap">{schedule.prompt}</p>
            </PopoverContent>
          </Popover>
          <div className="flex min-w-0 flex-col gap-0.5 pt-1">
            <span className="truncate text-sm font-medium">{schedule.name}</span>
            <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
              <Bot className="size-3.5 shrink-0" />
              <span className="truncate">{schedule.agentName}</span>
            </span>
          </div>
        </div>
      </TableCell>
      <TableCell className="px-3 py-4 align-top whitespace-normal">
        <p className="text-sm" title={schedule.cron}>
          {scheduleDescription}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">UTC</p>
      </TableCell>
      <TableCell className="px-3 py-4 align-top text-sm whitespace-nowrap tabular-nums">
        {formatUtc(schedule.nextRunAt)}
      </TableCell>
      <TableCell className="px-3 py-4 align-top whitespace-normal">
        {schedule.lastRunStatus ? (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span
                className={cn('size-2 shrink-0 rounded-full', runDotClass(schedule.lastRunStatus))}
              />
              <span className="text-sm">{runStatusLabel(schedule.lastRunStatus)}</span>
            </div>
            {schedule.lastRunAt && (
              <p className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                {formatUtc(schedule.lastRunAt)}
              </p>
            )}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">No runs yet</span>
        )}
      </TableCell>
      <TableCell className="px-3 py-3 align-top">
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {can('edit') && (
            <SettingsIconButton
              title={schedule.status === 'active' ? 'Pause schedule' : 'Resume schedule'}
              onClick={onToggle}
            >
              {schedule.status === 'active' ? (
                <Pause className="size-4" />
              ) : (
                <Play className="size-4" />
              )}
            </SettingsIconButton>
          )}
          <SettingsIconButton title="Run history" onClick={onHistory}>
            <History className="size-4" />
          </SettingsIconButton>
          {(can('edit') || can('delete')) && (
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-11 text-muted-foreground hover:text-foreground sm:size-8"
                    >
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>More actions</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end">
                {can('edit') && (
                  <DropdownMenuItem
                    className="min-h-11 sm:min-h-8"
                    disabled={running}
                    onSelect={onRun}
                  >
                    {running ? <RotateCw className="animate-spin" /> : <Zap />}
                    Run now
                  </DropdownMenuItem>
                )}
                {can('edit') && (
                  <DropdownMenuItem className="min-h-11 sm:min-h-8" onSelect={onEdit}>
                    <Pencil />
                    Edit schedule
                  </DropdownMenuItem>
                )}
                {can('delete') && can('edit') && <DropdownMenuSeparator />}
                {can('delete') && (
                  <DropdownMenuItem
                    className="min-h-11 sm:min-h-8"
                    variant="destructive"
                    onSelect={onDelete}
                  >
                    <Trash2 />
                    Delete schedule
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

function formatUtc(value: string): string {
  return `${new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(value))} UTC`;
}

function runStatusLabel(status: NonNullable<AgentSchedule['lastRunStatus']>): string {
  if (status === 'success') return 'Succeeded';
  if (status === 'failed') return 'Failed';
  return 'Pending';
}

function statusDotClass(status: AgentSchedule['status']): string {
  return status === 'active' ? 'bg-emerald-500' : 'bg-muted-foreground/40';
}

function runDotClass(status: NonNullable<AgentSchedule['lastRunStatus']>): string {
  if (status === 'success') return 'bg-emerald-500';
  if (status === 'failed') return 'bg-red-500';
  return 'bg-amber-500';
}
