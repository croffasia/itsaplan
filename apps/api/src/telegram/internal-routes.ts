import { Elysia, t } from 'elysia';
import { confirmTelegramLink, getInstanceBotConfig, isInstanceBotUsable } from './store';

// Internal endpoints the bot service calls. The bot holds no database connection and
// no encryption key: it asks for its token here and posts back the `/start` codes it
// receives, mirroring how the worker delivers notifications through
// /internal/notification-deliveries/send. Authenticated with the shared
// WORKER_INTERNAL_TOKEN.
//
// The config endpoint returns the bot token in plaintext. It is reachable only with
// that token, on the internal network, and the bot cannot work without it.

const linkBody = t.Object({
  code: t.String({ minLength: 1, maxLength: 64 }),
  chatId: t.String({ minLength: 1, maxLength: 128 }),
  username: t.Nullable(t.String()),
  firstName: t.Nullable(t.String()),
});

function authorized(headers: Record<string, string | undefined>): boolean {
  const expected = process.env.WORKER_INTERNAL_TOKEN;
  return Boolean(expected) && headers['x-worker-token'] === expected;
}

export const internalTelegramRoutes = new Elysia({ name: 'internal-telegram' })
  .get('/internal/telegram/config', async ({ headers, set }) => {
    if (!authorized(headers)) {
      set.status = 401;
      return { enabled: false, botToken: '', botUsername: '' };
    }
    const config = await getInstanceBotConfig();
    // A disabled or tokenless bot is reported as not enabled, so the service simply
    // stops polling instead of having to interpret the config itself.
    if (!isInstanceBotUsable(config)) return { enabled: false, botToken: '', botUsername: '' };
    return { enabled: true, botToken: config.botToken, botUsername: config.botUsername };
  })

  .post(
    '/internal/telegram/link',
    async ({ body, headers, set }) => {
      if (!authorized(headers)) {
        set.status = 401;
        return { ok: false as const, reason: 'invalid' as const };
      }
      return confirmTelegramLink(body);
    },
    { body: linkBody },
  );
