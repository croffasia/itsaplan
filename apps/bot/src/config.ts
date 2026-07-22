// Bot service configuration, read from the environment once behind a lazy getter so
// env is loaded (via --env-file / the container env) before it is read.
//
// The bot token is not here: it is instance configuration an administrator changes at
// runtime, so it is fetched from the api instead (see api.ts).

function intEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export interface BotConfig {
  // The api origin. Same resolution as the worker uses: SERVICE_URL_API in the
  // compose stack (Coolify sets it), API_URL locally.
  apiBaseUrl: string;
  // Shared secret for the /internal/* routes, the same value the worker uses.
  internalToken: string;
  // How often to re-read the bot settings from the api, so a token added or changed
  // in god mode takes effect without a restart.
  configPollIntervalMs: number;
  // How soon to retry after the api could not be reached. Shorter than the steady
  // interval: at startup the api is often still binding its port, and waiting a full
  // cycle would leave the bot idle for no reason.
  configRetryIntervalMs: number;
  timeoutMs: number;
}

let cached: BotConfig | null = null;

export function botConfig(): BotConfig {
  if (cached) return cached;
  const internalToken = process.env.WORKER_INTERNAL_TOKEN;
  if (!internalToken) throw new Error('WORKER_INTERNAL_TOKEN is required');
  const apiBaseUrl = process.env.SERVICE_URL_API ?? process.env.API_URL;
  if (!apiBaseUrl) throw new Error('SERVICE_URL_API or API_URL is required');
  cached = {
    apiBaseUrl,
    internalToken,
    configPollIntervalMs: intEnv('BOT_CONFIG_POLL_INTERVAL_MS', 30_000),
    configRetryIntervalMs: intEnv('BOT_CONFIG_RETRY_INTERVAL_MS', 5_000),
    timeoutMs: intEnv('BOT_API_TIMEOUT_MS', 15_000),
  };
  return cached;
}
