import { CalendarClock } from 'lucide-react';
import type { Issue } from '@/lib/api/endpoints/issues';
import { type Maps } from '@/utils/project';
import { formatDurationShort, formatShortDate, isDueOverdue } from '@/utils/dates';
import { formatMinutes } from '@/utils/estimate';
import { usePriorityLabel } from '@/hooks/usePriorityLabel';
import {
  AssigneeAvatar,
  DateBadge,
  DelegateAvatar,
} from '@/features/issue/components/shared/IssueBadges';
import { PriorityIcon, StateIcon } from '@/features/issue/components/shared/IssueIcons';
import { type TableColumn } from '../../utils/table';
import { TableLabelsCell } from './TableLabelsCell';

const DASH = <span className="text-muted-foreground/40">—</span>;

// One built-in property cell in a table row.
export function TableBuiltinCell({
  column,
  issue,
  maps,
}: {
  column: TableColumn;
  issue: Issue;
  maps: Maps;
}) {
  const priorityLabel = usePriorityLabel();
  switch (column) {
    case 'status': {
      const col = maps.columnById.get(issue.columnId);
      return (
        <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          {col ? (
            <>
              <StateIcon
                stateType={col.stateType}
                color={col.color}
                className="size-3.5 shrink-0"
              />
              <span className="truncate">{col.name}</span>
            </>
          ) : (
            DASH
          )}
        </div>
      );
    }
    case 'priority':
      return (
        <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          {issue.priority ? (
            <>
              <PriorityIcon priority={issue.priority} className="size-3.5 shrink-0" />
              <span className="truncate">{priorityLabel(issue.priority)}</span>
            </>
          ) : (
            DASH
          )}
        </div>
      );
    case 'type': {
      const type = issue.typeId != null ? maps.typeById.get(issue.typeId) : undefined;
      return (
        <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          {type ? (
            <>
              <span
                className="inline-block size-2 shrink-0 rounded-full"
                style={{ backgroundColor: type.color }}
              />
              <span className="truncate">{type.name}</span>
            </>
          ) : (
            DASH
          )}
        </div>
      );
    }
    case 'assignee': {
      const assignee =
        issue.assigneeUserId != null ? maps.assigneeById.get(issue.assigneeUserId) : undefined;
      return (
        <div className="flex">
          {assignee ? <AssigneeAvatar name={assignee.name} image={assignee.image} /> : DASH}
        </div>
      );
    }
    case 'delegate': {
      const delegate =
        issue.delegateUserId != null ? maps.assigneeById.get(issue.delegateUserId) : undefined;
      return (
        <div className="flex">
          {delegate ? <DelegateAvatar name={delegate.name} image={delegate.image} /> : DASH}
        </div>
      );
    }
    case 'initiative':
      return (
        <div className="truncate text-xs text-muted-foreground">
          {issue.initiative?.title ?? DASH}
        </div>
      );
    case 'cycle':
      return (
        <div className="truncate text-xs text-muted-foreground">{issue.cycle?.name ?? DASH}</div>
      );
    case 'labels': {
      const labels = issue.labelIds.flatMap((id) => maps.labelById.get(id) ?? []);
      if (labels.length === 0) return <div className="text-xs">{DASH}</div>;
      return <TableLabelsCell labels={labels} />;
    }
    case 'estimatePoints':
      return <div className="text-xs text-muted-foreground">{issue.estimatePoints ?? DASH}</div>;
    case 'estimateTime':
      return (
        <div className="text-xs text-muted-foreground">
          {issue.estimateMinutes == null ? DASH : formatMinutes(issue.estimateMinutes)}
        </div>
      );
    case 'startDate':
      return (
        <div className="text-xs text-muted-foreground">
          {issue.startDate ? formatShortDate(issue.startDate) : DASH}
        </div>
      );
    case 'dueDate': {
      if (!issue.dueDate) return <div className="text-xs">{DASH}</div>;
      // Only a missed date stands out; the rest read like the start date beside them.
      const overdue = isDueOverdue(issue.dueDate, maps.columnById.get(issue.columnId)?.stateType);
      return (
        <div className="text-xs text-muted-foreground">
          {overdue ? (
            <DateBadge icon={<CalendarClock className="size-2.5" />} date={issue.dueDate} overdue />
          ) : (
            formatShortDate(issue.dueDate)
          )}
        </div>
      );
    }
    case 'created':
      return (
        <div className="text-xs text-muted-foreground">{formatShortDate(issue.createdAt)}</div>
      );
    case 'updated':
      return (
        <div className="text-xs text-muted-foreground">{formatShortDate(issue.updatedAt)}</div>
      );
    case 'statusAge':
      return (
        <div className="text-xs text-muted-foreground">
          {formatDurationShort(issue.statusSince)}
        </div>
      );
  }
}
