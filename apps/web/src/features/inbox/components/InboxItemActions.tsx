import { type ElementType } from 'react';
import { CalendarClock, Clock, MailOpen, Trash2 } from 'lucide-react';

// The menu primitives to render with. DropdownMenu and ContextMenu expose the same
// component API, so the same item list backs both the "…" button and the row's
// right-click menu.
interface MenuComponents {
  Item: ElementType;
  Separator: ElementType;
  Sub: ElementType;
  SubTrigger: ElementType;
  SubContent: ElementType;
}

// The shared inbox-row actions: read/unread, a Snooze submenu (presets + pick a
// date, or unsnooze when already snoozed), and delete.
export default function InboxItemActions({
  menu,
  unread,
  snoozed,
  onToggleRead,
  onSnooze,
  onPickDate,
  onDelete,
}: {
  menu: MenuComponents;
  unread: boolean;
  snoozed: boolean;
  onToggleRead: (read: boolean) => void;
  onSnooze: (until: string | null) => void;
  onPickDate: () => void;
  onDelete: () => void;
}) {
  const { Item, Separator, Sub, SubTrigger, SubContent } = menu;
  return (
    <>
      <Item onSelect={() => onToggleRead(unread)}>
        <MailOpen />
        {unread ? 'Mark as read' : 'Mark as unread'}
      </Item>
      <Separator />
      {snoozed ? (
        <Item onSelect={() => onSnooze(null)}>
          <Clock />
          Unsnooze
        </Item>
      ) : (
        <Sub>
          <SubTrigger>
            <Clock />
            Snooze
          </SubTrigger>
          <SubContent>
            <Item onSelect={() => onSnooze(daysFromNow(1))}>Tomorrow</Item>
            <Item onSelect={() => onSnooze(daysFromNow(7))}>In a week</Item>
            <Separator />
            <Item onSelect={onPickDate}>
              <CalendarClock />
              Pick a date…
            </Item>
          </SubContent>
        </Sub>
      )}
      <Separator />
      <Item variant="destructive" onSelect={onDelete}>
        <Trash2 />
        Delete
      </Item>
    </>
  );
}

// An ISO time n days from now at 09:00 local, for the snooze presets.
function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
}
