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

export const NotificationPreferences = t.Object({
  emailEvents: EventToggles,
  telegramEvents: EventToggles,
  slackEvents: EventToggles,
  pushEvents: EventToggles,
});

// A PUT without slackEvents or pushEvents keeps what the project sends there now, so a
// client that predates a channel does not turn it off.
export const ProjectNotificationPreferenceBody = t.Object({
  emailEvents: EventTogglesBody,
  telegramEvents: EventTogglesBody,
  slackEvents: t.Optional(EventTogglesBody),
  pushEvents: t.Optional(EventTogglesBody),
});

export const AccountNotificationPreferencesResponse = t.Object({
  defaults: NotificationPreferences,
  projects: t.Array(
    t.Object({
      id: t.Number(),
      name: t.String(),
      team: t.Object({ id: t.Number(), name: t.String() }),
      slackTeamId: t.Nullable(
        t.String({
          description: 'The Slack workspace its messages go to, null while Slack is off.',
        }),
      ),
      preferences: t.Nullable(NotificationPreferences, {
        description: 'Null while the project follows the defaults.',
      }),
    }),
  ),
});

export const AccountNotificationPreferencesPatch = t.Object({
  defaults: t.Optional(NotificationPreferences),
  resetProjects: t.Optional(
    t.Boolean({
      description:
        'True returns every project to the defaults, archived ones and those the user left included. Applied before projects.',
    }),
  ),
  projects: t.Optional(
    t.Array(
      t.Object({
        projectId: t.Integer(),
        preferences: t.Nullable(NotificationPreferences, {
          description: 'Null returns the project to the defaults.',
        }),
      }),
    ),
  ),
});
