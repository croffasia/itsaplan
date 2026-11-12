import { useIconHover } from '@animateicons/react';
import { ChevronDownIcon } from '@animateicons/react/lucide/chevron-down-icon';
import { ChevronRightIcon } from '@animateicons/react/lucide/chevron-right-icon';
import { type IssueGroup } from '@/utils/project';
import { GroupDot } from '../shared/GroupDot';

export function SwimlaneHeader({
  swimlane,
  count,
  collapsed,
  onToggle,
}: {
  swimlane: IssueGroup;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const { ref, triggerProps } = useIconHover();
  const Chevron = collapsed ? ChevronRightIcon : ChevronDownIcon;
  return (
    <button
      type="button"
      {...triggerProps}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className="flex w-full items-center gap-2 bg-muted/30 px-4 py-1.5 text-sm font-medium text-foreground"
    >
      <Chevron ref={ref} size={14} className="text-muted-foreground" />
      <GroupDot group={swimlane} />
      {swimlane.name}
      <span className="text-muted-foreground">{count}</span>
    </button>
  );
}
