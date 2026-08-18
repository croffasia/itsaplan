import { t } from 'elysia';

const EventToggles = t.Object({
  assigned: t.Boolean(),
  mentioned: t.Boolean(),
  commented: t.Boolean(),
  state_changed: t.Boolean(),
});

// Request body of the PUT and the response of both routes.
export const NotificationPreferenceBody = t.Object({
  emailEvents: EventToggles,
  telegramEvents: EventToggles,
});
