// Bot service configuration, read from the environment once behind a lazy getter so
// env is loaded (via --env-file / the container env) before it is read.
//
// The bot token is not here: it is instance configuration an administrator changes at
// runtime, so it is read from the database (see db.ts).

function intEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export interface BotConfig {
  // How often to re-read the bot settings, so a token added or changed in god mode
  // takes effect without a restart.
  configPollIntervalMs: number;
  // How soon to retry after the database could not be reached. Shorter than the
  // steady interval: at startup Postgres is often still accepting its first
  // connections, and waiting a full cycle would leave the bot idle for no reason.
  configRetryIntervalMs: number;
}

let cached: BotConfig | null = null;

export function botConfig(): BotConfig {
  if (cached) return cached;
  cached = {
    configPollIntervalMs: intEnv('BOT_CONFIG_POLL_INTERVAL_MS', 30_000),
    configRetryIntervalMs: intEnv('BOT_CONFIG_RETRY_INTERVAL_MS', 5_000),
  };
  return cached;
}
