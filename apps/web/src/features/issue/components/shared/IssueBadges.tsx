import type { ReactNode } from 'react';
import { formatShortDate } from '@/utils/dates';
import { cn } from '@/lib/utils';
import Avatar from '@/components/common/Avatar';
import { PriorityIcon } from './IssueIcons';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// Small issue display badges shared by the project card (KanbanBoard) and the
// table cells (TableView) so both render the same pill/icon/avatar.

// Outline pill styling shared by the label and date badges.
const PILL = 'text-muted-foreground rounded-full px-1.5 py-0.5 text-[10px]';

// Priority glyph with a "<priority> priority" tooltip.
export function PriorityBadge({
  priority,
  className = 'size-3.5',
}: {
  priority: string;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">
          <PriorityIcon priority={priority} className={className} />
        </span>
      </TooltipTrigger>
      <TooltipContent className="capitalize">{priority} priority</TooltipContent>
    </Tooltip>
  );
}

// A single label as a colored-dot pill.
export function LabelBadge({ color, name }: { color: string; name: string }) {
  return (
    <Badge variant="outline" className={PILL}>
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {name}
    </Badge>
  );
}

// A date pill: a calendar icon (passed in, since start vs due use different
// glyphs) plus the short date. `overdue` renders it red (used for a past due date).
export function DateBadge({
  icon,
  date,
  title,
  overdue,
}: {
  icon: ReactNode;
  date: string;
  title?: string;
  overdue?: boolean;
}) {
  return (
    <Badge
      variant="outline"
      title={title}
      className={cn(PILL, overdue && 'border-destructive/40 text-destructive')}
    >
      {icon}
      {formatShortDate(date)}
    </Badge>
  );
}

// An assignee avatar with their name in a tooltip.
export function AssigneeAvatar({
  name,
  image,
  className,
}: {
  name: string;
  image?: string | null;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Avatar name={name} image={image} className={className} />
      </TooltipTrigger>
      <TooltipContent>{name}</TooltipContent>
    </Tooltip>
  );
}

// A delegate (AI agent) avatar. Same avatar as the agent gets on its comments,
// so the same face identifies it everywhere.
export function DelegateAvatar({
  name,
  image,
  className,
}: {
  name: string;
  image?: string | null;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Avatar name={name} image={image} className={className} />
      </TooltipTrigger>
      <TooltipContent>Delegated to {name}</TooltipContent>
    </Tooltip>
  );
}
