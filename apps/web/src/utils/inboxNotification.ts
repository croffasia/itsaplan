import type { useTranslations } from 'next-intl';
import type { Notification } from '@/lib/api/endpoints/notifications';
import { commentPath, documentPath, intakePath, issuePath } from '@/utils/paths';

type EventMessages = ReturnType<typeof useTranslations<'inbox.event'>>;

// What a notification is about: the intake request, the document, or the issue.
export function notificationSubject(n: Notification, untitled: string): string {
  if (n.intakeRequestId != null) {
    return n.intakeRequestTitle?.trim() || untitled;
  }
  return n.documentId != null
    ? [n.documentIcon, n.documentTitle?.trim() || untitled].filter(Boolean).join(' ')
    : `${n.projectKey}-${n.issueSeq} ${n.issueTitle}`;
}

// The verb phrase for a notification, addressed to the reader ("you").
export function notificationEventText(n: Notification, te: EventMessages): string {
  const who = n.actorName ?? te('someone');
  if (n.type === 'reacted') return te('reacted', { who, emoji: n.reactionEmoji ?? '' });
  if (n.type === 'intake_declined' && n.intakeDeclineReason) {
    return te('intakeDeclinedWithReason', { who, reason: n.intakeDeclineReason });
  }
  if (n.type !== 'state_changed') return te(n.type, { who });
  return n.fromState && n.toState
    ? te('stateChanged', { who, from: n.fromState, to: n.toState })
    : te('stateChangedPlain', { who });
}

// Where a notification leads: its document, its comment, its issue, or its intake queue.
export function notificationPath(n: Notification, ref: string): string | null {
  if (n.documentId != null) return documentPath(ref, n.documentId);
  if (n.issueSeq != null) {
    return n.issueCommentId != null
      ? commentPath(ref, n.issueSeq, n.issueCommentId)
      : issuePath(ref, n.issueSeq);
  }
  if (n.intakeRequestId != null) return intakePath(ref);
  return null;
}
