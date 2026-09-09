'use client';

import { CircleQuestionMark } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export default function RetentionHint() {
  const t = useTranslations('agentAnalytics');

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={t('retentionNote')}
          className="inline-flex rounded-full align-middle text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <CircleQuestionMark className="size-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{t('retentionNote')}</TooltipContent>
    </Tooltip>
  );
}
