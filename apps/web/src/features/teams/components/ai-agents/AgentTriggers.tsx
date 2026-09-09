import { AtSign, ListChecks, UserRoundCheck } from 'lucide-react';
import type { AiAgent } from '@/lib/api/endpoints/agents';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AgentTriggerChip, TRIGGER_CHIP } from './AgentTriggerChip';
import { useTranslations } from 'next-intl';

// The enabled run triggers for an internal agent (mention, delegation, member
// fields). Nothing is shown when none are on: an empty cell already says so. The
// field triggers carry their count, and name the fields in a popover.
export function AgentTriggers({ agent }: { agent: AiAgent }) {
  const t = useTranslations('teams.agents');
  const fieldCount = agent.fieldTriggers.length;
  if (!agent.triggerOnMention && !agent.triggerOnAssign && fieldCount === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {agent.triggerOnMention && <AgentTriggerChip icon={AtSign} label={t('triggerMention')} />}
      {agent.triggerOnAssign && (
        <AgentTriggerChip icon={UserRoundCheck} label={t('triggerDelegation')} />
      )}
      {fieldCount > 0 && (
        <Popover>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <button type="button" className={TRIGGER_CHIP} aria-label={t('triggerFieldsTitle')}>
                  <ListChecks className="size-3 shrink-0" />
                  {fieldCount}
                </button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent>{t('triggerFieldsTitle')}</TooltipContent>
          </Tooltip>
          <PopoverContent align="start" className="w-56 space-y-1.5 p-3">
            <p className="text-xs font-medium">{t('triggerFieldsTitle')}</p>
            <ul className="space-y-1">
              {agent.fieldTriggers.map((trigger) => (
                <li key={trigger.fieldId} className="truncate text-xs text-muted-foreground">
                  {trigger.name}
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
