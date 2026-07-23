import { ChevronsLeftRight, Plus } from 'lucide-react';
import { type IssueGroup } from '@/utils/project';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { GroupDot } from '../shared/GroupDot';

// A column collapsed to a narrow vertical strip. It stays in place (in column
// order) with its name reading vertically and its count visible; collapsing only
// gives the column's horizontal space back.
export function CollapsedColumn({
  group,
  count,
  onExpand,
  onAddIssue,
  readOnly,
}: {
  group: IssueGroup;
  count: number;
  onExpand: () => void;
  onAddIssue: () => void;
  // In a read-only share the add affordance is hidden.
  readOnly?: boolean;
}) {
  const { can } = usePermissions();
  const canCreateIssue = can('work_items', 'create') && !readOnly;
  return (
    <div className="flex h-full w-10 shrink-0 flex-col items-center gap-2 rounded-md border py-2">
      <Button
        variant="ghost"
        size="icon"
        className="size-6 text-muted-foreground"
        onClick={onExpand}
        title="Expand"
      >
        <ChevronsLeftRight />
      </Button>
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
      <GroupDot group={group} />
      <div className="flex flex-1 items-start gap-2 text-sm font-medium [writing-mode:vertical-rl]">
        <span className="text-foreground">{group.name}</span>
        <span className="text-muted-foreground">{count}</span>
      </div>
    </div>
  );
}
