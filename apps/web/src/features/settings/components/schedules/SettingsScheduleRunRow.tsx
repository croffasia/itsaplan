import { useId, useState } from 'react';
import { Ban, ChevronDown, ChevronRight } from 'lucide-react';
import type { AgentScheduleRun } from '@/lib/api';
import { formatDateTime } from '@/utils/dates';
import { AgentContextSize } from '@/components/common/agent-chat/AgentContextSize';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SettingsScheduleRunBlock } from './SettingsScheduleRunBlock';
import { useTranslations } from 'next-intl';

export function SettingsScheduleRunRow({
  run,
  canceling,
  onCancel,
}: {
  run: AgentScheduleRun;
  canceling: boolean;
  onCancel?: () => void;
}) {
  const t = useTranslations('settings.schedules');
  const [open, setOpen] = useState(false);
  const contentId = useId();
  const running = run.status === 'pending' && run.startedAt != null;
  return (
    <div>
      <div className="flex items-center gap-2 pe-2 hover:bg-accent/50">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 px-4 py-3 text-start text-xs"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={contentId}
        >
          {open ? (
            <ChevronDown className="size-3.5 shrink-0" />
          ) : (
            <ChevronRight className="size-3.5 shrink-0" />
          )}
          <Badge variant={statusVariant(run.status)}>
            {running ? t('runStatus.running') : t(`runStatus.${run.status}`)}
          </Badge>
          <span className="capitalize">{run.trigger}</span>
          <span className="ms-auto flex shrink-0 items-center gap-4">
            <span className="w-12 text-end">
              {run.contextTokens !== undefined && <AgentContextSize tokens={run.contextTokens} />}
            </span>
            <span className="text-muted-foreground tabular-nums">
              {formatDateTime(run.createdAt)}
            </span>
          </span>
        </button>
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
            title={t('cancelRun')}
            disabled={canceling}
            onClick={onCancel}
          >
            <Ban className="size-4" />
          </Button>
        )}
      </div>
      {open && (
        <div id={contentId} className="space-y-3 px-4 pb-4 text-xs">
          <SettingsScheduleRunBlock label={t('task')} value={run.prompt} />
          <SettingsScheduleRunBlock
            label={run.lastError ? t('error') : t('result')}
            value={run.lastError ?? run.output ?? t('noOutput')}
          />
        </div>
      )}
    </div>
  );
}

function statusVariant(
  status: AgentScheduleRun['status'],
): 'destructive' | 'secondary' | 'outline' {
  if (status === 'failed') return 'destructive';
  if (status === 'success') return 'secondary';
  return 'outline';
}
