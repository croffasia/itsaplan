'use client';

import { useTranslations } from 'next-intl';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// How large a conversation's context is after its last completed answer, which is what
// says how close it is to the agent's limit. Null where the agent reports no counts
// that can be read as a context size.
export function AgentContextSize({ tokens }: { tokens: number | null }) {
  const t = useTranslations('common.agentChat');

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="text-xs text-muted-foreground" dir="ltr">
          {tokens === null ? '—' : compact(tokens)}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {tokens === null ? t('contextUnavailable') : t('contextSize', { count: tokens })}
      </TooltipContent>
    </Tooltip>
  );
}

// Written the same way in every language: the localised compact form spells the
// thousands out ("42,1 тыс.") and takes more room than the row has.
function compact(tokens: number): string {
  return tokens < 1000 ? String(tokens) : `${(tokens / 1000).toFixed(1)}k`;
}
