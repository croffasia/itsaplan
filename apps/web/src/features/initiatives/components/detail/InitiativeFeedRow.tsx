'use client';

import Link from 'next/link';
import { formatDistanceToNow, parseISO } from 'date-fns';
import {
  CircleDot,
  CirclePlus,
  Pencil,
  FileText,
  SignalHigh,
  UserRound,
  Calendar,
  Tag,
  Flag,
} from 'lucide-react';
import type { InitiativeFeedItem } from '@/lib/api';
import { formatDate } from '@/utils/dates';
import { issuePath } from '@/utils/paths';
import { priorityLabel } from '@/utils/fieldOptions';
import { STATUS_META } from '../shared/initiativeMeta';

const ICON: Record<string, typeof CircleDot> = {
  created: CirclePlus,
  title: Pencil,
  description: FileText,
  status: CircleDot,
  priority: SignalHigh,
  owner: UserRound,
  assignee: UserRound,
  delegate: UserRound,
  start_date: Calendar,
  target_date: Calendar,
  due_date: Calendar,
  label_add: Tag,
  label_remove: Tag,
  type: Flag,
  initiative: Flag,
};

const fmtDate = (v: string | null) => (v ? formatDate(v) : '');
const statusLabel = (v: string | null) =>
  v && v in STATUS_META ? STATUS_META[v as keyof typeof STATUS_META].label : v;

// The verb phrase for one event. Initiative-source rows use initiative wording;
// issue-source rows describe the issue change (the issue is named separately).
function describe(a: InitiativeFeedItem): string {
  const onInitiative = a.source === 'initiative';
  switch (a.action) {
    case 'created':
      return onInitiative ? 'created the initiative' : 'created the issue';
    case 'title':
      return `renamed to “${a.toText}”`;
    case 'description':
      return a.toText ? 'updated the description' : 'cleared the description';
    case 'status':
      if (onInitiative) return `set status to ${statusLabel(a.toText)}`;
      return a.fromText ? `moved from ${a.fromText} to ${a.toText}` : `set status to ${a.toText}`;
    case 'priority':
      return a.toText ? `set priority to ${priorityLabel(a.toText)}` : 'removed priority';
    case 'owner':
      return a.toText ? `set owner to ${a.toText}` : `removed owner ${a.fromText}`;
    case 'assignee':
      return a.toText ? `assigned to ${a.toText}` : `removed assignee ${a.fromText}`;
    case 'delegate':
      return a.toText ? `delegated to ${a.toText}` : `removed delegate ${a.fromText}`;
    case 'target_date':
      return a.toText ? `set target date to ${fmtDate(a.toText)}` : 'removed target date';
    case 'start_date':
      return a.toText ? `set start date to ${fmtDate(a.toText)}` : 'removed start date';
    case 'due_date':
      return a.toText ? `set due date to ${fmtDate(a.toText)}` : 'removed due date';
    case 'label_add':
      return `added label ${a.toText}`;
    case 'label_remove':
      return `removed label ${a.fromText}`;
    case 'type':
      return a.toText ? `set type to ${a.toText}` : 'removed type';
    case 'initiative':
      return a.toText ? `linked to ${a.toText}` : 'unlinked from the initiative';
    default:
      return a.action ?? '';
  }
}

export default function InitiativeFeedRow({
  item,
  projectKey,
}: {
  item: InitiativeFeedItem;
  projectKey: string;
}) {
  const Icon = (item.action && ICON[item.action]) || CircleDot;
  const actor = item.actorName ?? 'System';
  return (
    <li className="flex items-center gap-2.5 text-xs">
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-3" />
      </span>
      <span className="min-w-0 text-muted-foreground">
        <span className="font-medium">{actor}</span> {describe(item)}
        {item.source === 'issue' && item.issueIdentifier != null && (
          <>
            {' '}
            <Link
              href={issuePath(projectKey, Number(item.issueIdentifier.split('-').pop()))}
              className="text-foreground/70 hover:text-foreground"
            >
              {item.issueIdentifier}
            </Link>
          </>
        )}
        <span className="ml-1.5">
          · {formatDistanceToNow(parseISO(item.createdAt), { addSuffix: true })}
        </span>
      </span>
    </li>
  );
}
