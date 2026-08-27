import {
  Ban,
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
import { formatUtc, parseScheduleInput } from '../../utils/cronSchedule';
import { useTranslations } from 'next-intl';

export function SettingsScheduleRow({
  schedule,
  running,
  onToggle,
  onRun,
  onCancelPending,
  onHistory,
  onEdit,
  onDelete,
}: {
  schedule: AgentSchedule;
  running: boolean;
  onToggle: () => void;
  onRun: () => void;
  onCancelPending: () => void;
  onHistory: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations('settings.schedules');
  const can = useSettingsCan();
  const parsedSchedule = parseScheduleInput(schedule.cron);
  const scheduleDescription = parsedSchedule.ok ? parsedSchedule.description : schedule.cron;
  return (
    <TableRow className="group/item cursor-pointer" onClick={onHistory}>
      <TableCell className="px-3 py-4 align-top whitespace-normal">
        <div className="flex min-w-0 items-start gap-2.5">
          <span
            className={cn('mt-[7px] size-2 shrink-0 rounded-full', statusDotClass(schedule.status))}
            title={schedule.status === 'active' ? t('statusActive') : t('statusPaused')}
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
              <TooltipContent>{t('viewTask')}</TooltipContent>
            </Tooltip>
            <PopoverContent align="start" className="w-80">
              <p className="text-xs font-medium text-muted-foreground">{t('task')}</p>
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
              <span className="text-sm">{t(`runStatus.${schedule.lastRunStatus}`)}</span>
            </div>
            {schedule.lastRunAt && (
              <p className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                {formatUtc(schedule.lastRunAt)}
              </p>
            )}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">{t('noRunsShort')}</span>
        )}
      </TableCell>
      <TableCell className="px-3 py-3 align-top">
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {can('edit') && (
            <SettingsIconButton
              title={schedule.status === 'active' ? t('pause') : t('resume')}
              onClick={onToggle}
            >
              {schedule.status === 'active' ? (
                <Pause className="size-4" />
              ) : (
                <Play className="size-4" />
              )}
            </SettingsIconButton>
          )}
          <SettingsIconButton title={t('runHistory')} onClick={onHistory}>
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
                <TooltipContent>{t('moreActions')}</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end">
                {can('edit') && (
                  <DropdownMenuItem
                    className="min-h-11 sm:min-h-8"
                    disabled={running}
                    onSelect={onRun}
                  >
                    {running ? <RotateCw className="animate-spin" /> : <Zap />}
                    {t('runNow')}
                  </DropdownMenuItem>
                )}
                {can('edit') && schedule.canTrigger && schedule.pendingRuns > 0 && (
                  <DropdownMenuItem className="min-h-11 sm:min-h-8" onSelect={onCancelPending}>
                    <Ban />
                    {t('cancelPending', { count: schedule.pendingRuns })}
                  </DropdownMenuItem>
                )}
                {can('edit') && (
                  <DropdownMenuItem className="min-h-11 sm:min-h-8" onSelect={onEdit}>
                    <Pencil />
                    {t('edit')}
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
                    {t('delete')}
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

function statusDotClass(status: AgentSchedule['status']): string {
  return status === 'active' ? 'bg-emerald-500' : 'bg-muted-foreground/40';
}

function runDotClass(status: NonNullable<AgentSchedule['lastRunStatus']>): string {
  if (status === 'success') return 'bg-emerald-500';
  if (status === 'failed') return 'bg-red-500';
  if (status === 'canceled') return 'bg-muted-foreground/40';
  return 'bg-amber-500';
}
