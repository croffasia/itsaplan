'use client';

import { type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { type FeedItem } from '@/lib/api';
import { formatDate } from '@/utils/dates';
import { isLinkRelation } from '@/utils/issueLinks';
import { byKey } from '@/utils/messageKey';
import { usePriorityLabel } from '@/hooks/usePriorityLabel';

const fmtDate = (v: string | null) => (v ? formatDate(v) : '');

// Long values (description, markdown/long custom fields) are shown behind a
// popover rather than inline, so the feed row stays compact.
const isLong = (text: string | null): text is string =>
  !!text && (text.length > 80 || text.includes('\n'));

// A custom field value shares its row with the field name as well as the actor, so
// it runs out of width sooner than a title does — a datetime range already wraps.
const isLongValue = (text: string | null): text is string =>
  !!text && (text.length > 40 || text.includes('\n'));

// The verb phrase for one activity event (everything after the actor's name),
// with a popover node when the change carries a long value worth expanding. The
// changed values are wrapped in <v>, which reads slightly brighter than the
// connective words — the whole row stays secondary to a comment.
export function useActivityText() {
  const t = useTranslations('issue.activity');
  const phrase = byKey(useTranslations('issueLinks.phrases'));
  const priorityLabel = usePriorityLabel();

  const v = (chunks: ReactNode) => <span className="text-foreground/70">{chunks}</span>;
  const linkPhrase = (subject: string | null) =>
    isLinkRelation(subject) ? phrase(subject) : t('linkedTo');

  return function describeActivity(a: FeedItem): { line: ReactNode; popover?: string } {
    const subject = a.payload.subject?.value ?? null;
    const from = a.payload.from?.value ?? null;
    const to = a.payload.to?.value ?? null;
    const line = (key: string, values: Record<string, string> = {}): ReactNode =>
      byKey(t)(key, values) as unknown as ReactNode;
    const rich = (key: string, values: Record<string, string> = {}): ReactNode =>
      (t.rich as unknown as (k: string, vals: Record<string, unknown>) => ReactNode)(key, {
        ...values,
        v,
      });

    switch (a.action) {
      case 'created':
        return { line: line('created') };
      case 'title':
        return isLong(to)
          ? { line: line('titleChanged'), popover: to }
          : { line: rich('renamed', { title: to ?? '' }) };
      case 'description':
        return to
          ? { line: line('descriptionUpdated'), popover: to }
          : { line: line('descriptionCleared') };
      case 'status':
        return from
          ? { line: rich('statusMoved', { from, to: to ?? '' }) }
          : { line: rich('statusSet', { status: to ?? '' }) };
      case 'assignee':
        if (!to) return { line: rich('assigneeRemoved', { name: from ?? '' }) };
        return {
          line: rich(from ? 'assigneeChanged' : 'assigneeSet', { name: to }),
        };
      case 'delegate':
        if (!to) return { line: rich('delegateRemoved', { name: from ?? '' }) };
        return {
          line: rich(from ? 'delegateChanged' : 'delegateSet', { name: to }),
        };
      case 'priority':
        return to
          ? { line: rich('prioritySet', { priority: priorityLabel(to) }) }
          : { line: line('priorityRemoved') };
      case 'type':
        return to ? { line: rich('typeSet', { type: to }) } : { line: line('typeRemoved') };
      case 'cycle':
        if (!to) return { line: rich('cycleRemoved', { cycle: from ?? '' }) };
        return {
          line: from ? rich('cycleMoved', { from, to }) : rich('cycleSet', { cycle: to }),
        };
      case 'estimate': {
        // The value arrives formatted, unlike a date or a priority.
        const kind = subject === 'time' ? 'Time' : 'Points';
        return to
          ? { line: rich(`estimate${kind}Set`, { value: to }) }
          : { line: line(`estimate${kind}Removed`) };
      }
      case 'start_date':
        return to
          ? { line: rich('startDateSet', { date: fmtDate(to) }) }
          : { line: line('startDateRemoved') };
      case 'due_date':
        return to
          ? { line: rich('dueDateSet', { date: fmtDate(to) }) }
          : { line: line('dueDateRemoved') };
      case 'label_add':
        return { line: rich('labelAdded', { label: to ?? '' }) };
      case 'label_remove':
        return { line: rich('labelRemoved', { label: from ?? '' }) };
      case 'link_add':
        return {
          line: rich('linkAdded', { relation: linkPhrase(subject), issue: to ?? '' }),
        };
      case 'link_remove':
        return {
          line: rich('linkRemoved', { relation: linkPhrase(subject), issue: to ?? '' }),
        };
      case 'parent':
        if (!to) return { line: rich('parentDetached', { parent: from ?? '' }) };
        return {
          line: from ? rich('parentMoved', { from, to }) : rich('parentSet', { parent: to }),
        };
      case 'subtask_add':
        return { line: rich('subtaskAdded', { subtask: to ?? '' }) };
      case 'subtask_remove':
        return { line: rich('subtaskRemoved', { subtask: from ?? '' }) };
      case 'checklist_add':
        return { line: rich('checklistAdded', { checklist: to ?? '' }) };
      case 'checklist_rename':
        return {
          line: rich('checklistRenamed', { from: from ?? '', to: to ?? '' }),
        };
      case 'checklist_remove':
        return { line: rich('checklistRemoved', { checklist: from ?? '' }) };
      case 'checklist_item_add':
        return {
          line: rich('checklistItemAdded', { item: to ?? '', checklist: subject ?? '' }),
        };
      case 'checklist_item_remove':
        return {
          line: rich('checklistItemRemoved', {
            item: from ?? '',
            checklist: subject ?? '',
          }),
        };
      case 'worklog': {
        // Each side carries the time it held and the day it was spent on.
        const fromDay = fmtDate(a.payload.from?.date ?? null);
        const toDay = fmtDate(a.payload.to?.date ?? null);
        if (!to) return { line: rich('worklogRemoved', { time: from ?? '', date: fromDay }) };
        if (!from) return { line: rich('worklogAdded', { time: to, date: toDay }) };
        return {
          line: rich('worklogChanged', { from, fromDate: fromDay, to, date: toDay }),
        };
      }
      case 'field':
        if (isLongValue(to))
          return { line: rich('fieldUpdated', { field: subject ?? '' }), popover: to };
        return to
          ? { line: rich('fieldSet', { field: subject ?? '', value: to }) }
          : { line: rich('fieldCleared', { field: subject ?? '' }) };
      case 'archived':
        return { line: line('archived') };
      case 'restored':
        return { line: line('restored') };
      case 'agent_started':
        return { line: line('agentStarted') };
      case 'agent_finished':
        return { line: line(subject === 'failed' ? 'agentFailed' : 'agentFinished') };
      case 'git_pr':
      case 'github_pr': {
        // The from side is "owner/repo#42", the to side the pull request's URL.
        const key = subject === 'merged' ? 'pullRequestMerged' : 'pullRequestOpened';
        const pr = (chunks: ReactNode) =>
          to ? (
            <a
              href={to}
              target="_blank"
              rel="noreferrer"
              className="text-foreground/70 underline underline-offset-2 hover:text-foreground"
            >
              {chunks}
            </a>
          ) : (
            v(chunks)
          );
        return {
          line: (t.rich as unknown as (k: string, vals: Record<string, unknown>) => ReactNode)(
            key,
            { pr: from ?? '', v: pr },
          ),
        };
      }
      default:
        return { line: a.action };
    }
  };
}
