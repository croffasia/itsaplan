'use client';

import Link from 'next/link';
import { parseISO } from 'date-fns';
import { useFormatter, useTranslations } from 'next-intl';
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
import { usePriorityLabel } from '@/hooks/usePriorityLabel';
import { STATUS_META } from '@/utils/initiativeMeta';

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

export default function InitiativeFeedRow({
  item,
  projectKey,
}: {
  item: InitiativeFeedItem;
  projectKey: string;
}) {
  const t = useTranslations('initiatives.feed');
  const tStatus = useTranslations('initiatives.status');
  const priorityLabel = usePriorityLabel();
  const format = useFormatter();

  // A status the initiative lifecycle knows is named in the reader's language; an
  // issue status is a project column and keeps the name the project gave it.
  const statusLabel = (v: string | null) =>
    v && v in STATUS_META ? tStatus(v as keyof typeof STATUS_META) : v;

  // The verb phrase for one event. Initiative-source rows use initiative wording;
  // issue-source rows describe the issue change (the issue is named separately).
  const describe = (a: InitiativeFeedItem): string => {
    const onInitiative = a.source === 'initiative';
    switch (a.action) {
      case 'created':
        return onInitiative ? t('createdInitiative') : t('createdIssue');
      case 'title':
        return t('renamed', { title: a.toText ?? '' });
      case 'description':
        return a.toText ? t('descriptionUpdated') : t('descriptionCleared');
      case 'status':
        if (onInitiative) return t('statusSet', { status: statusLabel(a.toText) ?? '' });
        return a.fromText
          ? t('statusMoved', { from: a.fromText, to: a.toText ?? '' })
          : t('statusSet', { status: a.toText ?? '' });
      case 'priority':
        return a.toText
          ? t('prioritySet', { priority: priorityLabel(a.toText) })
          : t('priorityRemoved');
      case 'owner':
        return a.toText
          ? t('ownerSet', { name: a.toText })
          : t('ownerRemoved', { name: a.fromText ?? '' });
      case 'assignee':
        return a.toText
          ? t('assigneeSet', { name: a.toText })
          : t('assigneeRemoved', { name: a.fromText ?? '' });
      case 'delegate':
        return a.toText
          ? t('delegateSet', { name: a.toText })
          : t('delegateRemoved', { name: a.fromText ?? '' });
      case 'target_date':
        return a.toText ? t('targetDateSet', { date: fmtDate(a.toText) }) : t('targetDateRemoved');
      case 'start_date':
        return a.toText ? t('startDateSet', { date: fmtDate(a.toText) }) : t('startDateRemoved');
      case 'due_date':
        return a.toText ? t('dueDateSet', { date: fmtDate(a.toText) }) : t('dueDateRemoved');
      case 'label_add':
        return t('labelAdded', { label: a.toText ?? '' });
      case 'label_remove':
        return t('labelRemoved', { label: a.fromText ?? '' });
      case 'type':
        return a.toText ? t('typeSet', { type: a.toText }) : t('typeRemoved');
      case 'initiative':
        return a.toText ? t('linked', { name: a.toText }) : t('unlinked');
      default:
        return a.action ?? '';
    }
  };

  const Icon = (item.action && ICON[item.action]) || CircleDot;
  const actor = item.actorName ?? t('system');
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
        <span className="ml-1.5">· {format.relativeTime(parseISO(item.createdAt))}</span>
      </span>
    </li>
  );
}
