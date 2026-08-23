import { ChevronDown, ChevronRight } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import { useTranslations } from 'next-intl';
import { DEFAULT_COLOR, type IssueGroup } from '@/utils/project';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { GroupDot } from '../shared/GroupDot';
import { SUBGROUP_H } from '../../utils/timeline';

// A sub-group header row (only present when sub-grouped). A row dropped onto it
// is appended to the sub-section, which reassigns both grouping fields.
export function TimelineSubgroupRow({
  sub,
  groupKey,
  count,
  collapsed,
  aggregateRect,
  labelW,
  trackWidth,
  onDrop,
  onToggle,
}: {
  sub: IssueGroup;
  groupKey: string;
  count: number;
  collapsed: boolean;
  aggregateRect: { left: number; width: number } | null;
  labelW: number;
  trackWidth: number;
  onDrop: (issueId: number) => void;
  onToggle: () => void;
}) {
  const t = useTranslations('workItems.timeline');
  const { setNodeRef, isOver: isDrop } = useDroppable({ id: `sec:${groupKey}`, data: { onDrop } });
  return (
    <div
      ref={setNodeRef}
      className={cn('flex border-b bg-muted/20', isDrop && 'bg-accent/60')}
      style={{ height: SUBGROUP_H }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={collapsed ? t('expandGroup') : t('collapseGroup')}
            onClick={onToggle}
            className={cn(
              'sticky left-0 z-10 flex shrink-0 items-center gap-2 overflow-hidden border-r pr-3 pl-7 text-left text-xs font-medium text-muted-foreground',
              isDrop ? 'bg-accent/60' : 'bg-muted/20',
            )}
            style={{ width: labelW }}
          >
            {collapsed ? (
              <ChevronRight className="size-3 shrink-0" />
            ) : (
              <ChevronDown className="size-3 shrink-0" />
            )}
            <GroupDot group={sub} />
            <span className="min-w-0 flex-1 truncate">{sub.name}</span>
            <span className="shrink-0 text-muted-foreground/70">{count}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>{collapsed ? t('expandGroup') : t('collapseGroup')}</TooltipContent>
      </Tooltip>
      <div className="relative" style={{ width: trackWidth }}>
        {collapsed && aggregateRect && (
          <div
            className="absolute top-1/2 flex h-3.5 -translate-y-1/2 cursor-default items-center overflow-hidden rounded px-1.5 text-[10px] text-white select-none"
            style={{
              left: aggregateRect.left,
              width: aggregateRect.width,
              backgroundColor: sub.color ?? DEFAULT_COLOR,
            }}
          >
            <span className="truncate">{sub.name}</span>
          </div>
        )}
      </div>
    </div>
  );
}
