import { ChevronDown, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { DEFAULT_COLOR, type IssueGroup } from '@/utils/project';
import { cn } from '@/lib/utils';
import { GroupDot } from '../shared/GroupDot';
import { SUBGROUP_H } from '../../utils/timeline';

// A sub-group header row (only present when sub-grouped). `data-group-key` carries
// the sub-section key, so dropping a bar on it reassigns both grouping fields.
export function TimelineSubgroupRow({
  sub,
  groupKey,
  count,
  collapsed,
  aggregateRect,
  labelW,
  trackWidth,
  isDrop,
  onToggle,
}: {
  sub: IssueGroup;
  groupKey: string;
  count: number;
  collapsed: boolean;
  aggregateRect: { left: number; width: number } | null;
  labelW: number;
  trackWidth: number;
  isDrop: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations('workItems.timeline');
  return (
    <div
      data-group-key={groupKey}
      className={cn('flex border-b bg-muted/20', isDrop && 'bg-accent/60')}
      style={{ height: SUBGROUP_H }}
    >
      <button
        type="button"
        title={collapsed ? t('expandGroup') : t('collapseGroup')}
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
