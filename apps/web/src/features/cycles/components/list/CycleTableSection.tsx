import { ChevronDown, ChevronRight } from 'lucide-react';
import { colorDot } from '@/components/common/fields/colorDot';
import type { CycleGroup } from '../../utils/cycleGroups';

// A group header above the cycles of one status, collapsible like the work items
// table sections.
export default function CycleTableSection({
  group,
  collapsed,
  onToggle,
}: {
  group: CycleGroup;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center gap-2 bg-muted/40 px-4 py-1.5 text-sm font-medium text-foreground"
    >
      {collapsed ? (
        <ChevronRight className="size-3.5 text-muted-foreground" />
      ) : (
        <ChevronDown className="size-3.5 text-muted-foreground" />
      )}
      {colorDot(group.color)}
      {group.label}
      <span className="text-muted-foreground">{group.cycles.length}</span>
    </button>
  );
}
