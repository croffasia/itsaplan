import { ChevronDown, ChevronRight } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import { useTranslations } from 'next-intl';
import { DEFAULT_COLOR, type IssueGroup } from '@/utils/project';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { GroupDot } from '../shared/GroupDot';
import { GROUP_H } from '../../utils/timeline';

// A group header row. A row dropped onto it is appended to the group, which
// reassigns the selected grouping field.
export function TimelineGroupRow({
  group,
  count,
  collapsed,
  aggregateRect,
  labelW,
  trackWidth,
  disabled,
  onDrop,
  onToggle,
}: {
  group: IssueGroup;
  count: number;
  collapsed: boolean;
  aggregateRect: { left: number; width: number } | null;
  labelW: number;
  trackWidth: number;
  // When sub-grouped, issues live under the sub-headers, so the group header is
  // only a drop target while the group is collapsed and they are hidden.
  disabled: boolean;
  onDrop: (issueId: number) => void;
  onToggle: () => void;
}) {
  const t = useTranslations('workItems.timeline');
  const { setNodeRef, isOver } = useDroppable({
    id: `sec:${group.key}`,
    data: { onDrop },
    disabled,
  });
  const isDrop = isOver && !disabled;
  return (
    <div
      ref={setNodeRef}
      className={cn('flex border-b bg-muted/40', isDrop && 'bg-accent/60')}
      style={{ height: GROUP_H }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={collapsed ? t('expandGroup') : t('collapseGroup')}
            onClick={onToggle}
            className={cn(
              'sticky left-0 z-10 flex shrink-0 items-center gap-2 overflow-hidden border-r px-3 text-left text-sm font-medium',
              isDrop ? 'bg-accent/60' : 'bg-muted/40',
            )}
            style={{ width: labelW }}
          >
            {collapsed ? (
              <ChevronRight className="size-3.5 shrink-0" />
            ) : (
              <ChevronDown className="size-3.5 shrink-0" />
            )}
            <GroupDot group={group} />
            <span className="min-w-0 flex-1 truncate">{group.name}</span>
            <span className="shrink-0 text-muted-foreground">{count}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>{collapsed ? t('expandGroup') : t('collapseGroup')}</TooltipContent>
      </Tooltip>
      <div className="relative" style={{ width: trackWidth }}>
        {collapsed && aggregateRect && (
          <div
            className="absolute top-1/2 flex h-4 -translate-y-1/2 cursor-default items-center overflow-hidden rounded px-1.5 text-[10px] text-white select-none"
            style={{
              left: aggregateRect.left,
              width: aggregateRect.width,
              backgroundColor: group.color ?? DEFAULT_COLOR,
            }}
          >
            <span className="truncate">{group.name}</span>
          </div>
        )}
      </div>
    </div>
  );
}
