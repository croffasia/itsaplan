import { t } from 'elysia';

const EventToggles = t.Object({
  assigned: t.Boolean(),
  mentioned: t.Boolean(),
  commented: t.Boolean(),
  state_changed: t.Boolean(),
});

// Response of both routes.
export const NotificationPreferenceBody = t.Object({
  emailEvents: EventToggles,
  telegramEvents: EventToggles,
  appriseEvents: EventToggles,
});

// Request body of the PUT. An omitted `appriseEvents` keeps the stored toggles, so a
// client written before Apprise existed can still save.
export const NotificationPreferenceUpdateBody = t.Object({
  emailEvents: EventToggles,
  telegramEvents: EventToggles,
  appriseEvents: t.Optional(EventToggles),
});
