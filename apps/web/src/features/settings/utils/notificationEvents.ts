import type { NotificationEventToggles } from '@/lib/api';

// The issue events a channel can send, matching the inbox notification types.
// Shared by the email and telegram event sections; the label of an event is a
// message under `settings.notifications.events`.
export const NOTIFICATION_EVENTS: (keyof NotificationEventToggles)[] = [
  'assigned',
  'mentioned',
  'commented',
  'state_changed',
];

export function eventsEqual(a: NotificationEventToggles, b: NotificationEventToggles): boolean {
  return (
    a.assigned === b.assigned &&
    a.mentioned === b.mentioned &&
    a.commented === b.commented &&
    a.state_changed === b.state_changed
  );
}
