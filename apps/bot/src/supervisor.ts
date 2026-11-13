import type { Bot } from 'grammy';
import { getInstanceBotConfig, getJobSettings, isInstanceBotUsable } from '@repo/db';
import { createBot } from './bot';

// Keeps the running bot in step with the instance settings. The token is not env
// configuration: an administrator sets it in god mode, so this polls the database and
// starts, stops, or replaces the bot when it changes. Without that, adding the token
// would need a redeploy.
//
// Long polling means exactly one process may hold the token — Telegram hands each
// update to a single getUpdates caller. That is why this service runs as one
// instance and must not be scaled to several replicas.

// How soon to try again after the database could not be read. Shorter than the steady
// interval, which is itself stored in the database: at startup Postgres is often still
// accepting its first connections.
const RETRY_INTERVAL_MS = 5000;

let current: { token: string; bot: Bot } | null = null;
let stopped = false;
let timer: ReturnType<typeof setTimeout> | null = null;

export interface SupervisorHandle {
  stop: () => Promise<void>;
}

export function startSupervisor(): SupervisorHandle {
  stopped = false;
  void loop();
  return { stop };
}

async function stop(): Promise<void> {
  stopped = true;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  await stopCurrent();
}

async function stopCurrent(): Promise<void> {
  if (!current) return;
  const { bot } = current;
  current = null;
  await bot.stop();
}

async function loop(): Promise<void> {
  if (stopped) return;
  let delay: number;
  try {
    delay = (await getJobSettings()).bot.configPollIntervalMs;
    await reconcile();
  } catch (err) {
    // The database being briefly unreachable must not kill the service, and a bot
    // already running keeps running meanwhile.
    delay = RETRY_INTERVAL_MS;
    const reason = err instanceof Error ? err.message : String(err);
    console.error(`[bot] could not read bot settings: ${reason}`);
  }
  if (stopped) return;
  timer = setTimeout(loop, delay);
}

async function reconcile(): Promise<void> {
  const settings = await getInstanceBotConfig();

  if (!isInstanceBotUsable(settings)) {
    if (current) console.log('[bot] bot turned off, stopping');
    await stopCurrent();
    return;
  }
  if (current?.token === settings.botToken) return;

  if (current) console.log('[bot] bot token changed, restarting');
  await stopCurrent();

  const bot = createBot(settings.botToken);
  const entry = { token: settings.botToken, bot };
  current = entry;
  // bot.start() resolves only when the bot stops, so it is not awaited here. It
  // rejects when the token is rejected by Telegram, which bot.catch does not cover:
  // clear the entry so the next poll tries again instead of assuming it is running.
  bot
    .start({
      onStart: (me) => console.log(`[bot] polling as @${me.username}`),
      // Only what this bot acts on, so Telegram does not queue updates it ignores.
      allowed_updates: ['message'],
    })
    .catch((err: unknown) => {
      const reason = err instanceof Error ? err.message : String(err);
      console.error(`[bot] polling stopped: ${reason}`);
      if (current === entry) current = null;
    });
}
