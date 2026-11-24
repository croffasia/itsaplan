import { MessagesSquare } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useShell } from '@/context/shellContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useRunningRuns } from '@/hooks/useRunningRuns';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import WorkingCount from '@/components/common/WorkingCount';

// The header's way to the project's agents, with how many of their runs work now.
export default function AgentsButton({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const t = useTranslations('nav');
  const { can } = usePermissions();
  const running = useRunningRuns(useShell().project);

  if (!can('ai_agents', 'read')) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={open ? 'default' : 'outline'}
          className="h-8 min-w-8 gap-1.5 px-1.5 has-[>svg]:px-1.5"
          aria-pressed={open}
          onClick={onToggle}
        >
          <MessagesSquare />
          <span className="sr-only">{t('agentsPanel')}</span>
          <WorkingCount
            count={running}
            label={t('runningRuns', { count: running })}
            className="border-s border-current/25 ps-2 pe-0.5"
          />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{t('agentsPanel')}</TooltipContent>
    </Tooltip>
  );
}
