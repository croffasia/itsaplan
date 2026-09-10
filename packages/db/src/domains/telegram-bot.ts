import { readSecret } from '../secrets';

// The instance Telegram bot, stored encrypted in app_secret under 'telegram.bot'.
// Three processes read it: the api (settings UI, account linking), the bot (long
// polling), and the worker (Telegram delivery falls back to this bot when a team set
// no token of its own). The api owns the write, so a field added here has to be set
// there too.

export const TELEGRAM_BOT_SECRET_KEY = 'telegram.bot';

export interface InstanceBotConfig {
  enabled: boolean;
  botToken: string; // secret
  // Resolved from getMe when the token is saved, so the deep link can be built
  // without asking the administrator to type the name a second time.
  botUsername: string;
}

export async function getInstanceBotConfig(): Promise<InstanceBotConfig> {
  const stored = await readSecret<InstanceBotConfig>(TELEGRAM_BOT_SECRET_KEY);
  // Merge over the default so a config written before a field was added stays valid.
  return { enabled: false, botToken: '', botUsername: '', ...stored };
}

// Whether the instance bot can be used right now. Account linking is offered only
// when this is true, and Telegram delivery falls back to this bot only when it is.
export function isInstanceBotUsable(config: InstanceBotConfig): boolean {
  return config.enabled && config.botToken.length > 0;
}
