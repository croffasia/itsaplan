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
        return isLong(a.toText)
          ? { line: line('titleChanged'), popover: a.toText }
          : { line: rich('renamed', { title: a.toText ?? '' }) };
      case 'description':
        return a.toText
          ? { line: line('descriptionUpdated'), popover: a.toText }
          : { line: line('descriptionCleared') };
      case 'status':
        return a.fromText
          ? { line: rich('statusMoved', { from: a.fromText, to: a.toText ?? '' }) }
          : { line: rich('statusSet', { status: a.toText ?? '' }) };
      case 'assignee':
        if (!a.toText) return { line: rich('assigneeRemoved', { name: a.fromText ?? '' }) };
        return {
          line: rich(a.fromText ? 'assigneeChanged' : 'assigneeSet', { name: a.toText }),
        };
      case 'delegate':
        if (!a.toText) return { line: rich('delegateRemoved', { name: a.fromText ?? '' }) };
        return {
          line: rich(a.fromText ? 'delegateChanged' : 'delegateSet', { name: a.toText }),
        };
      case 'priority':
        return a.toText
          ? { line: rich('prioritySet', { priority: priorityLabel(a.toText) }) }
          : { line: line('priorityRemoved') };
      case 'type':
        return a.toText
          ? { line: rich('typeSet', { type: a.toText }) }
          : { line: line('typeRemoved') };
      case 'cycle':
        if (!a.toText) return { line: rich('cycleRemoved', { cycle: a.fromText ?? '' }) };
        return {
          line: a.fromText
            ? rich('cycleMoved', { from: a.fromText, to: a.toText })
            : rich('cycleSet', { cycle: a.toText }),
        };
      case 'start_date':
        return a.toText
          ? { line: rich('startDateSet', { date: fmtDate(a.toText) }) }
          : { line: line('startDateRemoved') };
      case 'due_date':
        return a.toText
          ? { line: rich('dueDateSet', { date: fmtDate(a.toText) }) }
          : { line: line('dueDateRemoved') };
      case 'label_add':
        return { line: rich('labelAdded', { label: a.toText ?? '' }) };
      case 'label_remove':
        return { line: rich('labelRemoved', { label: a.fromText ?? '' }) };
      case 'link_add':
        return {
          line: rich('linkAdded', { relation: linkPhrase(a.subject), issue: a.toText ?? '' }),
        };
      case 'link_remove':
        return {
          line: rich('linkRemoved', { relation: linkPhrase(a.subject), issue: a.toText ?? '' }),
        };
      case 'parent':
        if (!a.toText) return { line: rich('parentDetached', { parent: a.fromText ?? '' }) };
        return {
          line: a.fromText
            ? rich('parentMoved', { from: a.fromText, to: a.toText })
            : rich('parentSet', { parent: a.toText }),
        };
      case 'subtask_add':
        return { line: rich('subtaskAdded', { subtask: a.toText ?? '' }) };
      case 'subtask_remove':
        return { line: rich('subtaskRemoved', { subtask: a.fromText ?? '' }) };
      case 'checklist_add':
        return { line: rich('checklistAdded', { checklist: a.toText ?? '' }) };
      case 'checklist_rename':
        return {
          line: rich('checklistRenamed', { from: a.fromText ?? '', to: a.toText ?? '' }),
        };
      case 'checklist_remove':
        return { line: rich('checklistRemoved', { checklist: a.fromText ?? '' }) };
      case 'checklist_item_add':
        return {
          line: rich('checklistItemAdded', { item: a.toText ?? '', checklist: a.subject ?? '' }),
        };
      case 'checklist_item_remove':
        return {
          line: rich('checklistItemRemoved', {
            item: a.fromText ?? '',
            checklist: a.subject ?? '',
          }),
        };
      case 'field':
        if (isLong(a.toText))
          return { line: rich('fieldUpdated', { field: a.subject ?? '' }), popover: a.toText };
        return a.toText
          ? { line: rich('fieldSet', { field: a.subject ?? '', value: a.toText }) }
          : { line: rich('fieldCleared', { field: a.subject ?? '' }) };
      case 'archived':
        return { line: line('archived') };
      case 'restored':
        return { line: line('restored') };
      case 'agent_started':
        return { line: line('agentStarted') };
      case 'agent_finished':
        return { line: line(a.subject === 'failed' ? 'agentFailed' : 'agentFinished') };
      case 'github_pr': {
        // fromText is "owner/repo#42", toText the PR's URL on GitHub.
        const key = a.subject === 'merged' ? 'pullRequestMerged' : 'pullRequestOpened';
        const pr = (chunks: ReactNode) =>
          a.toText ? (
            <a
              href={a.toText}
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
            { pr: a.fromText ?? '', v: pr },
          ),
        };
      }
      default:
        return { line: a.action };
    }
  };
}
