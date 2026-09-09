import { describe, it, expect, beforeEach } from 'bun:test';
import { writeSecret } from '@repo/db';
import { app } from '#tests/helpers/app';
import { resetDb } from '#tests/helpers/db';
import { getInstanceBotConfig, isInstanceBotUsable } from '#modules/telegram/service';

// The bot token is stored by the api and read back by the bot service itself: no route
// hands it out, and the bot holds no api credential. These cover that seam — the row
// the api writes under the key the bot reads, and the absence of a route that would
// return it.

async function storeBot(botToken: string, enabled = true): Promise<void> {
  await writeSecret(
    'telegram.bot',
    { enabled, botToken, botUsername: 'itsaplan_bot' },
    { enabled, botUsername: 'itsaplan_bot', hasBotToken: botToken.length > 0 },
  );
}

describe('telegram', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('has no route that returns the bot token', async () => {
    await storeBot('123:secret');
    const res = await app.handle(
      new Request('http://localhost/internal/telegram/config', {
        headers: { 'x-worker-token': process.env.WORKER_INTERNAL_TOKEN ?? '' },
      }),
    );
    expect(res.status).toBe(404);
    expect(await res.text()).not.toContain('123:secret');
  });

  it('reads back the stored bot config', async () => {
    expect(isInstanceBotUsable(await getInstanceBotConfig())).toBe(false);
    await storeBot('123:secret');
    const config = await getInstanceBotConfig();
    expect(config).toEqual({ enabled: true, botToken: '123:secret', botUsername: 'itsaplan_bot' });
    expect(isInstanceBotUsable(config)).toBe(true);
  });

  it('reports a disabled bot as unusable', async () => {
    await storeBot('123:secret', false);
    expect(isInstanceBotUsable(await getInstanceBotConfig())).toBe(false);
  });
});
