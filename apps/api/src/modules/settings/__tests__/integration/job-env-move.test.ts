import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import {
  JOB_SETTINGS_KEY,
  appSetting,
  db,
  defaultJobSettings,
  getJobSettings,
  getSetting,
  moveJobEnv,
  setSetting,
} from '@repo/db';
import { eq } from 'drizzle-orm';
import { resetDb } from '#tests/helpers/db';

// Releases before the job settings read these values from environment variables. Each
// service moves its own into the job settings once, at its first start.

const VARIABLES = [
  'WEBHOOK_POLL_INTERVAL_MS',
  'WEBHOOK_TIMEOUT_MS',
  'WEBHOOK_BATCH_SIZE',
  'WEBHOOK_CLEANUP_EVERY_TICKS',
  'NOTIFICATION_MAX_ATTEMPTS',
  'AGENT_CHAT_CLAIM_WAIT_MS',
  'AUTO_ARCHIVE_INTERVAL_MS',
  'AGENT_RUN_TIMEOUT_MS',
  'BOT_CONFIG_POLL_INTERVAL_MS',
  'BOT_CONFIG_RETRY_INTERVAL_MS',
];

describe('moving job settings from the environment', () => {
  const saved = Object.fromEntries(VARIABLES.map((name) => [name, process.env[name]]));

  beforeEach(async () => {
    await resetDb();
    for (const name of VARIABLES) delete process.env[name];
  });

  afterEach(() => {
    for (const name of VARIABLES) {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    }
  });

  it("moves the service's variables, converted into the setting's unit and range", async () => {
    process.env.WEBHOOK_POLL_INTERVAL_MS = '1000';
    process.env.WEBHOOK_TIMEOUT_MS = '30000';
    process.env.WEBHOOK_BATCH_SIZE = '9999';
    process.env.WEBHOOK_CLEANUP_EVERY_TICKS = '600';
    process.env.NOTIFICATION_MAX_ATTEMPTS = '7';
    process.env.AGENT_CHAT_CLAIM_WAIT_MS = '60000';

    await moveJobEnv('worker');

    const expected = defaultJobSettings();
    expected.webhooks.pollIntervalMs = 1000;
    expected.webhooks.timeoutMs = 30_000;
    expected.webhooks.batchSize = 500;
    expected.webhooks.cleanupIntervalMinutes = 10;
    expected.notifications.maxAttempts = 7;
    expect(await getJobSettings()).toEqual(expected);
  });

  it('clamps a value the old code capped, and turns milliseconds into minutes', async () => {
    process.env.AGENT_CHAT_CLAIM_WAIT_MS = '60000';
    process.env.AUTO_ARCHIVE_INTERVAL_MS = '900000';

    await moveJobEnv('api');

    const jobs = await getJobSettings();
    expect(jobs.agentChat.claimWaitMs).toBe(30_000);
    expect(jobs.sweeps.autoArchiveMinutes).toBe(15);
  });

  it('moves once: a later start leaves the settings to god mode', async () => {
    process.env.WEBHOOK_TIMEOUT_MS = '30000';
    await moveJobEnv('worker');
    const edited = await getJobSettings();
    edited.webhooks.timeoutMs = 20_000;
    await setSetting(JOB_SETTINGS_KEY, edited);

    process.env.WEBHOOK_TIMEOUT_MS = '40000';
    await moveJobEnv('worker');

    expect((await getJobSettings()).webhooks.timeoutMs).toBe(20_000);
  });

  it('records a service with nothing to move, so a variable set later is not read', async () => {
    await moveJobEnv('bot');

    process.env.BOT_CONFIG_POLL_INTERVAL_MS = '5000';
    await moveJobEnv('bot');

    expect(await getJobSettings()).toEqual(defaultJobSettings());
  });

  it('records each service on its own', async () => {
    process.env.WEBHOOK_TIMEOUT_MS = '30000';
    process.env.BOT_CONFIG_POLL_INTERVAL_MS = '5000';

    await Promise.all([moveJobEnv('api'), moveJobEnv('worker'), moveJobEnv('bot')]);
    await moveJobEnv('worker');

    const jobs = await getJobSettings();
    expect(jobs.webhooks.timeoutMs).toBe(30_000);
    expect(jobs.bot.configPollIntervalMs).toBe(5000);
    expect([...((await getSetting<string[]>('jobsEnvMoved')) ?? [])].sort()).toEqual([
      'api',
      'bot',
      'worker',
    ]);
  });

  it('ignores a variable whose setting is gone', async () => {
    process.env.BOT_CONFIG_RETRY_INTERVAL_MS = '1000';

    await moveJobEnv('bot');

    expect(await getJobSettings()).toEqual(defaultJobSettings());
  });

  it('moves the run time limit only while god mode has not saved one', async () => {
    process.env.AGENT_RUN_TIMEOUT_MS = '600000';
    await setSetting('agents', { traceRetentionDays: 7 });

    await moveJobEnv('api');

    expect(await getSetting('agents')).toEqual({ traceRetentionDays: 7, maxRunSeconds: 600 });
  });

  it('keeps a run time limit saved in god mode', async () => {
    process.env.AGENT_RUN_TIMEOUT_MS = '600000';
    await setSetting('agents', { maxRunSeconds: 900 });

    await moveJobEnv('api');

    expect(await getSetting('agents')).toEqual({ maxRunSeconds: 900 });
  });

  it('fails and records nothing while the job settings row is missing', async () => {
    process.env.WEBHOOK_TIMEOUT_MS = '30000';
    await db.delete(appSetting).where(eq(appSetting.key, JOB_SETTINGS_KEY));

    await expect(moveJobEnv('worker')).rejects.toThrow('apply the database migrations');
    expect(await getSetting('jobsEnvMoved')).toBeNull();
  });
});
