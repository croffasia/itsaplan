import type {
  NotificationEventToggles,
  NotificationPreferences,
} from '@/lib/api/endpoints/notificationPreferences';

// The events a channel can send, matching the inbox notification types. The label of an
// event is a message under `account.notifications.events`.
export const NOTIFICATION_EVENTS: (keyof NotificationEventToggles)[] = [
  'assigned',
  'mentioned',
  'commented',
  'state_changed',
  'reacted',
];

// The channels in the order of their columns, with the field that holds their events.
export const CHANNEL_EVENTS = {
  email: 'emailEvents',
  telegram: 'telegramEvents',
  slack: 'slackEvents',
  push: 'pushEvents',
} as const satisfies Record<string, keyof NotificationPreferences>;

export type NotificationChannel = keyof typeof CHANNEL_EVENTS;

const NO_EVENTS: NotificationEventToggles = {
  assigned: false,
  mentioned: false,
  commented: false,
  state_changed: false,
  reacted: false,
};

export const NO_NOTIFICATIONS: NotificationPreferences = {
  emailEvents: NO_EVENTS,
  telegramEvents: NO_EVENTS,
  slackEvents: NO_EVENTS,
  pushEvents: NO_EVENTS,
};

// A set with these channels taken from another one.
export function withChannels(
  preferences: NotificationPreferences,
  channels: NotificationChannel[],
  from: NotificationPreferences,
): NotificationPreferences {
  return {
    ...preferences,
    ...Object.fromEntries(
      channels.map((channel) => [CHANNEL_EVENTS[channel], from[CHANNEL_EVENTS[channel]]]),
    ),
  };
}

// Whether none of these channels sends anything.
export function isOff(
  preferences: NotificationPreferences,
  channels: NotificationChannel[],
): boolean {
  return channels.every((channel) =>
    NOTIFICATION_EVENTS.every((event) => !preferences[CHANNEL_EVENTS[channel]][event]),
  );
}
