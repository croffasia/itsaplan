import { CalendarClock } from 'lucide-react';
import { type Issue } from '@/lib/api';
import { type Maps } from '@/utils/project';
import { formatDurationShort, formatShortDate, isDueOverdue } from '@/utils/dates';
import {
  AssigneeAvatar,
  DateBadge,
  DelegateAvatar,
  LabelBadge,
  PriorityBadge,
} from '@/features/issue/components/shared/IssueBadges';
import { StateIcon } from '@/features/issue/components/shared/IssueIcons';
import { type TableColumn } from '../../utils/table';

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
        <div className="flex items-center">
          {issue.priority ? <PriorityBadge priority={issue.priority} /> : DASH}
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
        <div className="flex justify-end">
          {assignee ? <AssigneeAvatar name={assignee.name} image={assignee.image} /> : DASH}
        </div>
      );
    }
    case 'delegate': {
      const delegate =
        issue.delegateUserId != null ? maps.assigneeById.get(issue.delegateUserId) : undefined;
      return (
        <div className="flex justify-end">
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
    case 'labels':
      return (
        <div className="flex min-w-0 flex-wrap items-center gap-1 overflow-hidden">
          {issue.labelIds.length > 0
            ? issue.labelIds.map((id) => {
                const label = maps.labelById.get(id);
                if (!label) return null;
                return <LabelBadge key={id} color={label.color} name={label.name} />;
              })
            : DASH}
        </div>
      );
    case 'startDate':
      return (
        <div className="text-xs text-muted-foreground">
          {issue.startDate ? formatShortDate(issue.startDate) : DASH}
        </div>
      );
    case 'dueDate':
      return (
        <div className="text-xs">
          {issue.dueDate ? (
            <DateBadge
              icon={<CalendarClock className="size-2.5" />}
              date={issue.dueDate}
              overdue={isDueOverdue(issue.dueDate, maps.columnById.get(issue.columnId)?.stateType)}
            />
          ) : (
            DASH
          )}
        </div>
      );
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
