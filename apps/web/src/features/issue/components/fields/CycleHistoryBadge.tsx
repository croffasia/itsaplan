'use client';

import { History } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useIssueCyclesQuery } from '@/services/issues.service';
import { formatShortDate } from '@/utils/dates';
import { CYCLE_STATUS_META } from '@/utils/cycleMeta';
import { colorDot } from '@/components/common/fields/colorDot';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// How many cycles the issue was in, opening the list of them. Nothing is shown until
// there is more than one: the picker next to it already names a single cycle.
export default function CycleHistoryBadge({ issueId }: { issueId: number }) {
  const t = useTranslations('issue.cycleHistory');
  const entries = useIssueCyclesQuery(issueId).data ?? [];
  if (entries.length < 2) return null;

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Badge asChild variant="secondary" className="px-1.5 py-0 text-[10px]">
              <button type="button" aria-label={t('title')}>
                <History />
                {entries.length}
              </button>
            </Badge>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{t('title')}</TooltipContent>
      </Tooltip>
      <PopoverContent align="start" className="w-64 p-0">
        <p className="border-b border-border px-3.5 py-2.5 text-xs font-medium text-muted-foreground">
          {t('title')}
        </p>
        <ul className="divide-y divide-border">
          {entries.map((entry) => (
            <li key={entry.cycleId} className="px-3.5 py-2">
              <span className="flex min-w-0 items-center gap-1.5">
                {colorDot(CYCLE_STATUS_META[entry.status].color)}
                <span className="truncate text-xs">{entry.name}</span>
              </span>
              <span className="block ps-4 text-xs text-muted-foreground">
                {formatShortDate(entry.startDate)} – {formatShortDate(entry.endDate)}
              </span>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
