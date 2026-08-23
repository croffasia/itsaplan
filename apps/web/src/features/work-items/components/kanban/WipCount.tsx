import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { type WipState, WIP_FULL_TEXT, wipFullColor } from '../../utils/wipLimit';

// The issue count in a column header. Without a WIP limit it is the bare number
// the board has always shown; with one it reads `count / max` and is marked at or
// past the limit — red where a hard limit refuses work, yellow where a soft one
// only warns.
//
// The count is the column's real occupancy rather than the cards on screen, so the
// limit reads the same to every viewer. Where filters hide some of them, the number
// the cards below add up to is shown alongside it.
export function WipCount({
  filteredCount,
  wip,
  filtered,
}: {
  filteredCount: number;
  wip: WipState | null;
  filtered: boolean;
}) {
  const t = useTranslations('workItems.wip');

  if (!wip) return <span className="text-muted-foreground">{filteredCount}</span>;

  // Only worth two numbers when the filters actually hide some of the column.
  const partial = filtered && filteredCount !== wip.count;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'tabular-nums',
            wip.full ? `font-medium ${WIP_FULL_TEXT[wipFullColor(wip)]}` : 'text-muted-foreground',
          )}
        >
          {partial
            ? t('filteredCount', { shown: filteredCount, total: wip.count, max: wip.limit })
            : t('count', { count: wip.count, max: wip.limit })}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {partial
          ? t('filteredTooltip', { shown: filteredCount, total: wip.count, max: wip.limit })
          : t('tooltip', { max: wip.limit })}
      </TooltipContent>
    </Tooltip>
  );
}
