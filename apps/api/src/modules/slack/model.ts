import { t } from 'elysia';

const slackAppFields = {
  hasBotToken: t.Boolean(),
  clientId: t.String(),
  hasClientSecret: t.Boolean(),
  // Resolved from the bot token when it is saved, so the administrator can confirm it.
  slackTeamName: t.String(),
  // The address to list among the app's redirect URLs.
  redirectUrl: t.String(),
};

const slackAppPatchFields = {
  botToken: t.Optional(t.String()),
  clientId: t.Optional(t.String({ maxLength: 200 })),
  clientSecret: t.Optional(t.String()),
};

export const InstanceSlackSettingsResponse = t.Object({ enabled: t.Boolean(), ...slackAppFields });

export const InstanceSlackSettingsBody = t.Object({
  enabled: t.Optional(t.Boolean()),
  ...slackAppPatchFields,
});

export const WorkspaceSlackSettingsResponse = t.Object({
  enabled: t.Boolean(),
  own: t.Boolean(),
  ...slackAppFields,
  instanceSlackTeamName: t.Nullable(t.String()),
});

export const WorkspaceSlackSettingsBody = t.Object({
  enabled: t.Boolean(),
  own: t.Boolean(),
  ...slackAppPatchFields,
});

export const SlackAccountResponse = t.Object({
  slackTeamId: t.String(),
  slackTeamName: t.Nullable(t.String()),
  available: t.Boolean({
    description: "Whether one of the user's projects sends to this Slack workspace.",
  }),
  link: t.Nullable(t.Object({ name: t.Nullable(t.String()), linkedAt: t.String() })),
});

export const SlackLinkStartResponse = t.Object({ url: t.String() });

export const SlackLinkCompleteBody = t.Object({
  code: t.String({ minLength: 1, maxLength: 512 }),
  state: t.String({ minLength: 1, maxLength: 64 }),
});
