import type { NotificationEventToggles } from '@/lib/api';

// The issue events a channel can send, matching the inbox notification types, with a
// display label. Shared by the email and telegram event sections.
export const NOTIFICATION_EVENTS: { key: keyof NotificationEventToggles; label: string }[] = [
  { key: 'assigned', label: 'Assigned to an issue' },
  { key: 'mentioned', label: 'Mentioned in a comment' },
  { key: 'commented', label: 'New comment on a followed issue' },
  { key: 'state_changed', label: 'Issue state changed' },
];

export function eventsEqual(a: NotificationEventToggles, b: NotificationEventToggles): boolean {
  return (
    a.assigned === b.assigned &&
    a.mentioned === b.mentioned &&
    a.commented === b.commented &&
    a.state_changed === b.state_changed
  );
}
