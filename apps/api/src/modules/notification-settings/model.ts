import { t } from 'elysia';
import { ENCRYPTION_MODES } from './service';

const encryption = t.UnionEnum([...ENCRYPTION_MODES]);

// The redacted settings DTO (NotificationSettingsDto from the service): the
// project's provider credentials. Secrets are never returned; each is replaced by a
// boolean telling whether a value is stored.
export const NotificationSettingsResponse = t.Object({
  // Deliver email through the instance provider instead of the project's own.
  system: t.Object({ enabled: t.Boolean() }),
  // Whether that instance provider exists and is shared with projects right now.
  // The project cannot see or change it, so the UI states why sending is off.
  systemAvailable: t.Boolean(),
  smtp: t.Object({
    enabled: t.Boolean(),
    host: t.String(),
    port: t.Nullable(t.Number()),
    encryption,
    username: t.String(),
    hasPassword: t.Boolean(),
    timeout: t.Nullable(t.Number()),
  }),
  resend: t.Object({ enabled: t.Boolean(), hasApiKey: t.Boolean() }),
  telegram: t.Object({ enabled: t.Boolean(), hasBotToken: t.Boolean() }),
});

// Every section optional so each provider card can save on its own. Secret fields
// are optional and, when omitted or empty, keep their stored value.
export const NotificationSettingsBody = t.Object({
  system: t.Optional(t.Object({ enabled: t.Boolean() })),
  smtp: t.Optional(
    t.Object({
      enabled: t.Boolean(),
      host: t.String(),
      port: t.Nullable(t.Integer({ minimum: 1, maximum: 65535 })),
      encryption,
      username: t.String(),
      password: t.Optional(t.String()),
      timeout: t.Nullable(t.Integer({ minimum: 1 })),
    }),
  ),
  resend: t.Optional(t.Object({ enabled: t.Boolean(), apiKey: t.Optional(t.String()) })),
  telegram: t.Optional(t.Object({ enabled: t.Boolean(), botToken: t.Optional(t.String()) })),
});
