import { t } from 'elysia';

export const TelegramAccountResponse = t.Object({
  botUsername: t.Nullable(t.String()),
  link: t.Nullable(
    t.Object({
      username: t.Nullable(t.String()),
      firstName: t.Nullable(t.String()),
      linkedAt: t.String(),
    }),
  ),
});

export const TelegramLinkStartResponse = t.Object({
  url: t.String(),
  expiresAt: t.String(),
});
