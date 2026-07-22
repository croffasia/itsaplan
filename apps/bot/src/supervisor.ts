import type { Bot } from 'grammy';
import { botConfig } from './config';
import { fetchBotConfig } from './api';
import { createBot } from './bot';

// Keeps the running bot in step with the instance settings. The token is not env
// configuration: an administrator sets it in god mode, so this polls the api and
// starts, stops, or replaces the bot when it changes. Without that, adding the token
// would need a redeploy.
//
// Long polling means exactly one process may hold the token — Telegram hands each
// update to a single getUpdates caller. That is why this service runs as one
// instance and must not be scaled to several replicas.

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
  const cfg = botConfig();
  let delay = cfg.configPollIntervalMs;
  try {
    await reconcile();
  } catch (err) {
    // The api being briefly unreachable must not kill the service, and a bot already
    // running keeps running meanwhile. This is the normal case at startup, where the
    // api is still binding its port — so retry sooner than the steady-state interval
    // instead of leaving the bot idle for a full poll cycle.
    delay = cfg.configRetryIntervalMs;
    const reason = err instanceof Error ? err.message : String(err);
    console.error(`[bot] could not read bot settings from ${cfg.apiBaseUrl}: ${reason}`);
  }
  if (stopped) return;
  timer = setTimeout(loop, delay);
}

async function reconcile(): Promise<void> {
  const settings = await fetchBotConfig();

  if (!settings.enabled || !settings.botToken) {
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
