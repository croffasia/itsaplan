import type { NotificationEventToggles } from '@/lib/api/endpoints/notificationSettings';

// The events a channel can send, matching the inbox notification types.
// Shared by the email, Telegram and push columns; the label of an event is a
// message under `settings.notifications.events`.
export const NOTIFICATION_EVENTS: (keyof NotificationEventToggles)[] = [
  'assigned',
  'mentioned',
  'commented',
  'state_changed',
  'reacted',
];

export function eventsEqual(a: NotificationEventToggles, b: NotificationEventToggles): boolean {
  return (
    a.assigned === b.assigned &&
    a.mentioned === b.mentioned &&
    a.commented === b.commented &&
    a.state_changed === b.state_changed &&
    a.reacted === b.reacted
  );
}
