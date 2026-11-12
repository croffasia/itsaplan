import { useIconHover } from '@animateicons/react';
import { ChevronDownIcon } from '@animateicons/react/lucide/chevron-down-icon';
import { ChevronRightIcon } from '@animateicons/react/lucide/chevron-right-icon';
import { type IssueGroup } from '@/utils/project';
import { GroupDot } from '../shared/GroupDot';
import { TableDropZone } from './TableDropZone';

// A sub-group header row (only present when sub-grouped). A drop onto it appends
// to the sub-group's bucket.
export function TableSubHeader({
  sub,
  count,
  collapsed,
  dropId,
  onDrop,
  onToggle,
}: {
  sub: IssueGroup;
  count: number;
  collapsed: boolean;
  dropId: string;
  onDrop: (issueId: number) => void;
  onToggle: () => void;
}) {
  const { ref, triggerProps } = useIconHover();
  const Chevron = collapsed ? ChevronRightIcon : ChevronDownIcon;
  return (
    <TableDropZone
      id={dropId}
      onDrop={onDrop}
      className="flex items-center bg-muted/20 py-1 ps-9 pe-4"
    >
      <button
        type="button"
        {...triggerProps}
        onClick={onToggle}
        className="flex items-center gap-2 text-xs font-medium text-muted-foreground"
      >
        <Chevron ref={ref} size={12} />
        <GroupDot group={sub} />
        {sub.name}
        <span className="text-muted-foreground/70">{count}</span>
      </button>
    </TableDropZone>
  );
}
