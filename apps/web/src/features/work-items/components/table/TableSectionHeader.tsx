import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { type IssueGroup } from '@/utils/project';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { GroupDot } from '../shared/GroupDot';
import { TableDropZone } from './TableDropZone';

// A primary group header row. A drop onto it appends to the group's bucket
// (disabled when sub-grouped, where issues live under sub-headers).
export function TableSectionHeader({
  group,
  count,
  collapsed,
  disabled,
  dropId,
  onDrop,
  onToggle,
  onAddIssue,
  readOnly,
}: {
  group: IssueGroup;
  count: number;
  collapsed: boolean;
  disabled: boolean;
  dropId: string;
  onDrop: (issueId: number) => void;
  onToggle: () => void;
  onAddIssue: () => void;
  // In a read-only share the add affordance is hidden.
  readOnly?: boolean;
}) {
  const { can } = usePermissions();
  const canCreateIssue = can('work_items', 'create') && !readOnly;
  return (
    <TableDropZone
      id={dropId}
      disabled={disabled}
      onDrop={onDrop}
      className="flex items-center justify-between bg-muted/40 px-4 py-1.5"
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-2 text-sm font-medium text-foreground"
      >
        {collapsed ? (
          <ChevronRight className="size-3.5 text-muted-foreground" />
        ) : (
          <ChevronDown className="size-3.5 text-muted-foreground" />
        )}
        <GroupDot group={group} />
        {group.name}
        <span className="text-muted-foreground">{count}</span>
      </button>
      {canCreateIssue && (
        <Button
          variant="ghost"
          size="icon"
          className="size-6 text-muted-foreground"
          onClick={onAddIssue}
          title="New issue"
        >
          <Plus />
        </Button>
      )}
    </TableDropZone>
  );
}
