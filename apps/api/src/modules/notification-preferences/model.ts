import { t } from 'elysia';

const EventToggles = t.Object({
  assigned: t.Boolean(),
  mentioned: t.Boolean(),
  commented: t.Boolean(),
  state_changed: t.Boolean(),
});

// The response of both routes.
export const NotificationPreferenceResponse = t.Object({
  emailEvents: EventToggles,
  telegramEvents: EventToggles,
  pushEvents: EventToggles,
});

// A PUT without pushEvents keeps the stored ones, so a client that predates push
// does not turn it off.
export const NotificationPreferenceBody = t.Object({
  emailEvents: EventToggles,
  telegramEvents: EventToggles,
  pushEvents: t.Optional(EventToggles),
});
