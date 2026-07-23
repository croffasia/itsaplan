import { CalendarArrowUp, CalendarClock, Target, Timer } from 'lucide-react';
import { type Issue } from '@/lib/api';
import { type Maps } from '@/utils/project';
import { formatDurationShort, formatShortDate, isDueOverdue } from '@/utils/dates';
import type { DisplayProperty, PropertyKey } from '@/utils/viewSettings';
import {
  AssigneeAvatar,
  DateBadge,
  DelegateAvatar,
  LabelBadge,
  PriorityBadge,
} from '@/features/issue/components/shared/IssueBadges';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { StateIcon } from '@/features/issue/components/shared/IssueIcons';

// One board card's content. Which properties render is driven by `properties`.
export function IssueCardBody({
  issue,
  maps,
  properties,
}: {
  issue: Issue;
  maps: Maps;
  properties: PropertyKey[];
}) {
  const has = (p: DisplayProperty) => properties.includes(p);
  const type = issue.typeId != null ? maps.typeById.get(issue.typeId) : undefined;
  const assignee =
    issue.assigneeUserId != null ? maps.assigneeById.get(issue.assigneeUserId) : undefined;
  const delegate =
    issue.delegateUserId != null ? maps.assigneeById.get(issue.delegateUserId) : undefined;
  const initiative = issue.initiative ?? undefined;
  const column = maps.columnById.get(issue.columnId);
  const metaShown =
    has('statusAge') ||
    (has('dueDate') && issue.dueDate) ||
    (has('startDate') && issue.startDate) ||
    (has('type') && type) ||
    (has('initiative') && initiative) ||
    (has('labels') && issue.labelIds.length > 0);
  const footerShown =
    has('created') ||
    has('updated') ||
    (has('assignee') && assignee) ||
    (has('delegate') && delegate);

  return (
    <>
      {(has('id') || (has('priority') && issue.priority)) && (
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{has('id') ? issue.identifier : ''}</span>
          {has('priority') && issue.priority && <PriorityBadge priority={issue.priority} />}
        </div>
      )}

      <div className="mb-2 flex items-start gap-1.5">
        {has('status') && column && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="mt-px inline-flex shrink-0">
                <StateIcon stateType={column.stateType} color={column.color} className="size-3.5" />
              </span>
            </TooltipTrigger>
            <TooltipContent>{column.name}</TooltipContent>
          </Tooltip>
        )}
        <span className="line-clamp-2 text-sm leading-snug text-foreground">{issue.title}</span>
      </div>

      {metaShown && (
        <div className="flex min-h-[22px] flex-wrap items-center gap-1">
          {has('statusAge') && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className="rounded-full px-1.5 py-0.5 text-[10px] text-muted-foreground"
                >
                  <Timer className="size-2.5" />
                  {formatDurationShort(issue.statusSince)}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                In current status since {formatShortDate(issue.statusSince)}
              </TooltipContent>
            </Tooltip>
          )}
          {has('startDate') && issue.startDate && (
            <DateBadge
              icon={<CalendarArrowUp className="size-2.5" />}
              date={issue.startDate}
              title="Start date"
            />
          )}
          {has('dueDate') && issue.dueDate && (
            <DateBadge
              icon={<CalendarClock className="size-2.5" />}
              date={issue.dueDate}
              title="Due date"
              overdue={isDueOverdue(issue.dueDate, column?.stateType)}
            />
          )}
          {has('type') && type && (
            <Badge
              variant="outline"
              className="rounded-full px-1.5 py-0.5 text-[10px] text-muted-foreground"
            >
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: type.color }}
              />
              {type.name}
            </Badge>
          )}
          {has('initiative') && initiative && (
            <Badge
              variant="outline"
              className="max-w-full rounded-full px-1.5 py-0.5 text-[10px] text-muted-foreground"
            >
              <Target className="size-2.5 shrink-0" />
              <span className="truncate">{initiative.title}</span>
            </Badge>
          )}
          {has('labels') &&
            issue.labelIds.map((id) => {
              const label = maps.labelById.get(id);
              if (!label) return null;
              return <LabelBadge key={id} color={label.color} name={label.name} />;
            })}
        </div>
      )}

      {footerShown && (
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[11px] text-muted-foreground/70">
            {has('created') && `Created ${formatShortDate(issue.createdAt)}`}
            {has('created') && has('updated') && ' · '}
            {has('updated') && `Updated ${formatShortDate(issue.updatedAt)}`}
          </span>
          {/* Negative spacing so a delegate and an assignee shown together
              overlap; the ring in the card color keeps them separated. */}
          <div className="flex items-center -space-x-1.5">
            {has('delegate') && delegate && (
              <DelegateAvatar
                name={delegate.name}
                image={delegate.image}
                className="ring-2 ring-[var(--kanban-card)]"
              />
            )}
            {has('assignee') && assignee && (
              <AssigneeAvatar
                name={assignee.name}
                image={assignee.image}
                className="ring-2 ring-[var(--kanban-card)]"
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
