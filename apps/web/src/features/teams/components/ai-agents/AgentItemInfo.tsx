import { useTranslations } from 'next-intl';
import { useIconHover } from '@animateicons/react';
import { InfoIcon } from '@animateicons/react/lucide/info-icon';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// What an item of the agent editor does, in a tooltip behind an "i" beside its name.
export function AgentItemInfo({ name, description }: { name: string; description: string }) {
  const t = useTranslations('teams.agents');
  const { ref, triggerProps } = useIconHover();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={t('aboutItem', { name })}
          {...triggerProps}
          className="inline-flex shrink-0 rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <InfoIcon ref={ref} size={14} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-72">
        {description}
      </TooltipContent>
    </Tooltip>
  );
}
