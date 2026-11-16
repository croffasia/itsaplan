'use client';

import { useTranslations } from 'next-intl';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { compactTokens } from '@/utils/compactTokens';

// How large a conversation's context is after its last completed answer, which is what
// says how close it is to the agent's limit. Null where the agent reports no counts
// that can be read as a context size.
export function AgentContextSize({ tokens }: { tokens: number | null }) {
  const t = useTranslations('common.agentChat');

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="text-xs text-muted-foreground" dir="ltr">
          {tokens === null ? '—' : compactTokens(tokens)}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {tokens === null ? t('contextUnavailable') : t('contextSize', { count: tokens })}
      </TooltipContent>
    </Tooltip>
  );
}
