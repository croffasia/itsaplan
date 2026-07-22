import { type ReactNode } from 'react';
import { formatDate } from '@/utils/dates';

import {
  Archive,
  ArchiveRestore,
  Calendar,
  CircleDot,
  CirclePlus,
  FileText,
  Pencil,
  Shapes,
  SignalHigh,
  Bot,
  Tag,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { type ActivityAction, type FeedItem } from '@/lib/api';
import { priorityLabel } from '@/utils/fieldOptions';

// Renders one activity feed event as an icon plus a verb phrase. Kept out of the
// feed component so the switch over action types stays isolated from the layout.

export const ACTION_ICON: Record<ActivityAction, LucideIcon> = {
  created: CirclePlus,
  title: Pencil,
  description: FileText,
  status: CircleDot,
  assignee: UserRound,
  delegate: Bot,
  priority: SignalHigh,
  type: Shapes,
  start_date: Calendar,
  due_date: Calendar,
  label_add: Tag,
  label_remove: Tag,
  field: Pencil,
  archived: Archive,
  restored: ArchiveRestore,
};

const fmtDate = (v: string | null) => (v ? formatDate(v) : '');

// Long values (description, markdown/long custom fields) are shown behind a
// popover rather than inline, so the feed row stays compact.
const isLong = (text: string | null): text is string =>
  !!text && (text.length > 80 || text.includes('\n'));

// The verb phrase for one event (everything after the actor's name). Returns a
// popover node too when the change carries a long value worth expanding.
export function describeActivity(a: FeedItem): { line: ReactNode; popover?: string } {
  // Values are slightly brighter than the connective words but still muted —
  // the whole activity row reads as secondary to comments.
  const strong = (t: string | null) => <span className="text-foreground/70">{t}</span>;
  switch (a.action) {
    case 'created':
      return { line: 'created the issue' };
    case 'title':
      return isLong(a.toText)
        ? { line: 'changed the title', popover: a.toText }
        : { line: <>renamed to {strong(`“${a.toText}”`)}</> };
    case 'description':
      return a.toText
        ? { line: 'updated the description', popover: a.toText }
        : { line: 'cleared the description' };
    case 'status':
      return a.fromText
        ? {
            line: (
              <>
                moved from {strong(a.fromText)} to {strong(a.toText)}
              </>
            ),
          }
        : { line: <>set status to {strong(a.toText)}</> };
    case 'assignee':
      if (!a.toText) return { line: <>removed assignee {strong(a.fromText)}</> };
      return {
        line: a.fromText ? (
          <>re-assigned to {strong(a.toText)}</>
        ) : (
          <>assigned to {strong(a.toText)}</>
        ),
      };
    case 'delegate':
      if (!a.toText) return { line: <>removed delegate {strong(a.fromText)}</> };
      return {
        line: a.fromText ? (
          <>re-delegated to {strong(a.toText)}</>
        ) : (
          <>delegated to {strong(a.toText)}</>
        ),
      };
    case 'priority':
      return a.toText
        ? { line: <>set priority to {strong(priorityLabel(a.toText))}</> }
        : { line: 'removed priority' };
    case 'type':
      return a.toText ? { line: <>set type to {strong(a.toText)}</> } : { line: 'removed type' };
    case 'start_date':
      return a.toText
        ? { line: <>set start date to {strong(fmtDate(a.toText))}</> }
        : { line: 'removed start date' };
    case 'due_date':
      return a.toText
        ? { line: <>set due date to {strong(fmtDate(a.toText))}</> }
        : { line: 'removed due date' };
    case 'label_add':
      return { line: <>added label {strong(a.toText)}</> };
    case 'label_remove':
      return { line: <>removed label {strong(a.fromText)}</> };
    case 'field':
      if (isLong(a.toText)) return { line: <>updated {strong(a.subject)}</>, popover: a.toText };
      return a.toText
        ? {
            line: (
              <>
                set {strong(a.subject)} to {strong(a.toText)}
              </>
            ),
          }
        : { line: <>cleared {strong(a.subject)}</> };
    case 'archived':
      return { line: 'archived the issue' };
    case 'restored':
      return { line: 'restored the issue' };
    default:
      return { line: a.action };
  }
}
