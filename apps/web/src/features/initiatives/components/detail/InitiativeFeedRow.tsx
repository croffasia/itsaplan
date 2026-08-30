'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
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
import { useRelativeTime } from '@/context/relativeTimeContext';
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
  const relativeTime = useRelativeTime();

  // A status the initiative lifecycle knows is named in the reader's language; an
  // issue status is a project column and keeps the name the project gave it.
  const statusLabel = (v: string | null) =>
    v && v in STATUS_META ? tStatus(v as keyof typeof STATUS_META) : v;

  // The verb phrase for one event. Initiative-source rows use initiative wording;
  // issue-source rows describe the issue change (the issue is named separately).
  const describe = (a: InitiativeFeedItem): string => {
    const onInitiative = a.source === 'initiative';
    const from = a.payload.from?.value ?? null;
    const to = a.payload.to?.value ?? null;
    switch (a.action) {
      case 'created':
        return onInitiative ? t('createdInitiative') : t('createdIssue');
      case 'title':
        return t('renamed', { title: to ?? '' });
      case 'description':
        return to ? t('descriptionUpdated') : t('descriptionCleared');
      case 'status':
        if (onInitiative) return t('statusSet', { status: statusLabel(to) ?? '' });
        return from
          ? t('statusMoved', { from, to: to ?? '' })
          : t('statusSet', { status: to ?? '' });
      case 'priority':
        return to ? t('prioritySet', { priority: priorityLabel(to) }) : t('priorityRemoved');
      case 'owner':
        return to ? t('ownerSet', { name: to }) : t('ownerRemoved', { name: from ?? '' });
      case 'assignee':
        return to ? t('assigneeSet', { name: to }) : t('assigneeRemoved', { name: from ?? '' });
      case 'delegate':
        return to ? t('delegateSet', { name: to }) : t('delegateRemoved', { name: from ?? '' });
      case 'target_date':
        return to ? t('targetDateSet', { date: fmtDate(to) }) : t('targetDateRemoved');
      case 'start_date':
        return to ? t('startDateSet', { date: fmtDate(to) }) : t('startDateRemoved');
      case 'due_date':
        return to ? t('dueDateSet', { date: fmtDate(to) }) : t('dueDateRemoved');
      case 'label_add':
        return t('labelAdded', { label: to ?? '' });
      case 'label_remove':
        return t('labelRemoved', { label: from ?? '' });
      case 'type':
        return to ? t('typeSet', { type: to }) : t('typeRemoved');
      case 'initiative':
        return to ? t('linked', { name: to }) : t('unlinked');
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
        <span className="ml-1.5">· {relativeTime(item.createdAt)}</span>
      </span>
    </li>
  );
}
