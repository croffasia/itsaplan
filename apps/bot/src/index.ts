import { startSupervisor } from './supervisor';

// Entry point for the Telegram bot service. It runs long polling for the instance
// bot and completes the account links users start from their profile. The token
// comes from the api at runtime, so this starts even before a bot is configured and
// picks one up when an administrator adds it.
console.log('[bot] bot service starting');
const supervisor = startSupervisor();

function shutdown(signal: string): void {
  console.log(`[bot] ${signal} received, stopping`);
  // Stopping ends the current getUpdates call, so Telegram hands the next update to
  // the replacement process instead of timing out against this one.
  // Exit either way: bot.stop() makes a final getUpdates call, and a failure there
  // must not leave the process hanging.
  void supervisor
    .stop()
    .catch((err: unknown) => console.error('[bot] stop failed:', err))
    .finally(() => process.exit(0));
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
