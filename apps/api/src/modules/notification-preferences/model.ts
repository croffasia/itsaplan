import { t } from 'elysia';

const baseEventFields = {
  assigned: t.Boolean(),
  mentioned: t.Boolean(),
  commented: t.Boolean(),
  state_changed: t.Boolean(),
};

const EventToggles = t.Object({ ...baseEventFields, reacted: t.Boolean() });

// `reacted` left out reads as off, so a client that predates it still saves.
const EventTogglesBody = t.Object({ ...baseEventFields, reacted: t.Optional(t.Boolean()) });

// The response of both routes.
export const NotificationPreferenceResponse = t.Object({
  emailEvents: EventToggles,
  telegramEvents: EventToggles,
  pushEvents: EventToggles,
});

// A PUT without pushEvents keeps the stored ones, so a client that predates push
// does not turn it off.
export const NotificationPreferenceBody = t.Object({
  emailEvents: EventTogglesBody,
  telegramEvents: EventTogglesBody,
  pushEvents: t.Optional(EventTogglesBody),
});
