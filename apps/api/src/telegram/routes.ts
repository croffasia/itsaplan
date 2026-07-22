import { Elysia, t } from 'elysia';
import { authContext } from '../shared/auth-context';
import { requireUser } from '../shared/access';
import { HttpError } from '../shared/lib';
import { ErrorResponse } from '../shared/responses';
import { noContent } from '../shared/http';
import {
  getInstanceBotConfig,
  getTelegramLink,
  isInstanceBotUsable,
  startTelegramLink,
  unlinkTelegram,
} from './store';

// The session user's own Telegram account link. Linking runs through the instance
// bot: this mints a one-time code and returns the deep link that opens the bot with
// it; the bot service completes the link when the user presses start. Everything
// here is self-scoped — a user only ever reads or changes their own link.
//
// `botUsername` is null when no instance bot is configured, which is how the UI
// knows not to offer Telegram at all.

const TelegramAccountResponse = t.Object({
  botUsername: t.Nullable(t.String()),
  link: t.Nullable(
    t.Object({
      username: t.Nullable(t.String()),
      firstName: t.Nullable(t.String()),
      linkedAt: t.String(),
    }),
  ),
});

const TelegramLinkStartResponse = t.Object({
  url: t.String(),
  expiresAt: t.String(),
});

export const telegramRoutes = new Elysia({ name: 'telegram', detail: { tags: ['Telegram'] } })
  .use(authContext)

  .get(
    '/telegram/account',
    async ({ user }) => {
      const me = requireUser(user);
      const config = await getInstanceBotConfig();
      const link = await getTelegramLink(me.id);
      return {
        botUsername: isInstanceBotUsable(config) ? config.botUsername : null,
        link: link && {
          username: link.username,
          firstName: link.firstName,
          linkedAt: link.linkedAt,
        },
      };
    },
    {
      response: { 200: TelegramAccountResponse, 401: ErrorResponse },
      detail: {
        summary: 'Get the linked Telegram account',
        description:
          "The session user's Telegram link, and the instance bot to link through (null when none is configured).",
      },
    },
  )

  .post(
    '/telegram/account/link',
    async ({ user }) => {
      const me = requireUser(user);
      const config = await getInstanceBotConfig();
      if (!isInstanceBotUsable(config)) {
        throw new HttpError(400, 'Telegram is not configured on this instance');
      }
      const { code, expiresAt } = await startTelegramLink(me.id);
      return { url: `https://t.me/${config.botUsername}?start=${code}`, expiresAt };
    },
    {
      response: { 200: TelegramLinkStartResponse, 400: ErrorResponse, 401: ErrorResponse },
      detail: {
        summary: 'Start linking a Telegram account',
        description:
          'Mints a one-time code and returns the bot deep link that completes the link when opened.',
      },
    },
  )

  .delete(
    '/telegram/account',
    async ({ user }) => {
      const me = requireUser(user);
      await unlinkTelegram(me.id);
      return noContent();
    },
    {
      response: { 204: t.Void(), 401: ErrorResponse },
      detail: { summary: 'Unlink the Telegram account' },
    },
  );
