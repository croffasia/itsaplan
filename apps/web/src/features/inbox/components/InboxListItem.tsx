import { useState } from 'react';
import {
  AtSign,
  CircleDot,
  Clock,
  MessageSquare,
  MoreHorizontal,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { type Notification, type NotificationType } from '@/lib/api';
import { formatDurationShort } from '@/utils/dates';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import InboxItemActions from './InboxItemActions';
import InboxSnoozeCalendar from './InboxSnoozeCalendar';

const TYPE_ICON: Record<NotificationType, LucideIcon> = {
  assigned: UserRound,
  mentioned: AtSign,
  commented: MessageSquare,
  state_changed: CircleDot,
};

// The verb phrase for a notification, addressed to the reader ("you").
function notificationText(n: Notification): string {
  const who = n.actorName ?? 'Someone';
  switch (n.type) {
    case 'assigned':
      return `${who} assigned the issue to you`;
    case 'mentioned':
      return `${who} mentioned you`;
    case 'commented':
      return `${who} commented`;
    case 'state_changed':
      return `${who} changed the status`;
  }
}

const dropdownMenu = {
  Item: DropdownMenuItem,
  Separator: DropdownMenuSeparator,
  Sub: DropdownMenuSub,
  SubTrigger: DropdownMenuSubTrigger,
  SubContent: DropdownMenuSubContent,
};

const contextMenu = {
  Item: ContextMenuItem,
  Separator: ContextMenuSeparator,
  Sub: ContextMenuSub,
  SubTrigger: ContextMenuSubTrigger,
  SubContent: ContextMenuSubContent,
};

// One inbox row: the issue identifier and title, the event line, elapsed time, an
// unread dot, and the actions menu (opened from the "…" button or a right-click).
// Read rows are dimmed. Clicking the row selects it; the menu handles its own
// clicks without selecting.
export default function InboxListItem({
  notification: n,
  selected,
  onSelect,
  onToggleRead,
  onSnooze,
  onDelete,
}: {
  notification: Notification;
  selected: boolean;
  onSelect: () => void;
  onToggleRead: (read: boolean) => void;
  onSnooze: (until: string | null) => void;
  onDelete: () => void;
}) {
  const [pickOpen, setPickOpen] = useState(false);
  const Icon = TYPE_ICON[n.type];
  const unread = n.readAt == null;
  const snoozed = n.snoozedUntil != null && new Date(n.snoozedUntil).getTime() > Date.now();

  const actionsProps = {
    unread,
    snoozed,
    onToggleRead,
    onSnooze,
    onDelete,
    // Opening the calendar as the menu closes fights for focus; defer a frame.
    onPickDate: () => requestAnimationFrame(() => setPickOpen(true)),
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          role="button"
          tabIndex={0}
          onClick={onSelect}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect()}
          className={cn(
            'group flex w-full items-start gap-3 border-b px-4 py-3 text-left transition-colors',
            selected ? 'bg-accent' : 'hover:bg-accent/50',
          )}
        >
          <Icon
            className={cn(
              'mt-0.5 size-4 shrink-0',
              unread ? 'text-foreground' : 'text-muted-foreground',
            )}
          />
          <div className="min-w-0 flex-1">
            <span
              className={cn(
                'block truncate text-sm',
                unread ? 'font-medium text-foreground' : 'text-muted-foreground',
              )}
            >
              {n.projectKey}-{n.issueSeq} {n.issueTitle}
            </span>
            <span className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
              {snoozed && <Clock className="size-3 shrink-0" />}
              {notificationText(n)}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2 pt-0.5">
            <span className="text-xs text-muted-foreground group-hover:hidden">
              {formatDurationShort(n.createdAt)}
            </span>
            {unread && <span className="size-2 rounded-full bg-primary group-hover:hidden" />}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden size-6 group-hover:flex data-[state=open]:flex"
                  onClick={(e) => e.stopPropagation()}
                  title="More"
                >
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <InboxItemActions menu={dropdownMenu} {...actionsProps} />
              </DropdownMenuContent>
            </DropdownMenu>

            <InboxSnoozeCalendar open={pickOpen} onOpenChange={setPickOpen} onPick={onSnooze} />
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <InboxItemActions menu={contextMenu} {...actionsProps} />
      </ContextMenuContent>
    </ContextMenu>
  );
}
