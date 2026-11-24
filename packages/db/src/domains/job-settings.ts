import { eq, sql } from 'drizzle-orm';
import { db, type DbExecutor } from '../client';
import { appSetting } from '../schema/app';
import { getSetting } from '../settings';

// How the background jobs of the api, the worker and the bot run (app_setting key 'jobs').
// The row is the only source: migration 0180 writes every value, god mode edits them, and
// each job reads the row on every pass, so a change applies without a restart. The api
// owns the write (modules/settings/service.ts's setJobSettings).

export const JOB_SETTINGS_KEY = 'jobs';

export interface JobSettings {
  webhooks: {
    // Also paces notification deliveries: the worker sends both on one pass.
    pollIntervalMs: number;
    batchSize: number;
    timeoutMs: number;
    maxAttempts: number;
    disableThreshold: number;
    leaseSeconds: number;
    retentionDays: number;
    cleanupIntervalMinutes: number;
  };
  notifications: {
    batchSize: number;
    maxAttempts: number;
    leaseSeconds: number;
  };
  imports: {
    pollIntervalMs: number;
  };
  agentRuns: {
    pollIntervalMs: number;
    maxAttempts: number;
    leaseSeconds: number;
  };
  agentChat: {
    leaseSeconds: number;
    maxAttempts: number;
    claimWaitMs: number;
    claimPollMs: number;
    streamPollMs: number;
    historyMessages: number;
  };
  agentInvocations: {
    pollIntervalMs: number;
    timeoutMs: number;
  };
  sweeps: {
    autoArchiveMinutes: number;
    tracePruneMinutes: number;
    shareExpiryMinutes: number;
  };
  bot: {
    configPollIntervalMs: number;
  };
}

export type JobSettingsPatch = { [G in keyof JobSettings]?: Partial<JobSettings[G]> };

type Bounds = readonly [min: number, max: number];

// The range each value may take. The api validates a change against it, and a value moved
// from the environment is clamped into it.
export const JOB_SETTING_BOUNDS: {
  [G in keyof JobSettings]: Record<keyof JobSettings[G], Bounds>;
} = {
  webhooks: {
    pollIntervalMs: [100, 600_000],
    batchSize: [1, 500],
    timeoutMs: [1000, 300_000],
    maxAttempts: [1, 50],
    disableThreshold: [1, 1000],
    leaseSeconds: [10, 3600],
    retentionDays: [1, 3650],
    cleanupIntervalMinutes: [1, 1440],
  },
  notifications: { batchSize: [1, 500], maxAttempts: [1, 50], leaseSeconds: [10, 3600] },
  imports: { pollIntervalMs: [100, 600_000] },
  agentRuns: { pollIntervalMs: [100, 600_000], maxAttempts: [1, 20], leaseSeconds: [10, 86_400] },
  agentChat: {
    leaseSeconds: [10, 86_400],
    maxAttempts: [1, 20],
    // The runner gives up on its request after 35 seconds.
    claimWaitMs: [1000, 30_000],
    claimPollMs: [50, 10_000],
    streamPollMs: [50, 10_000],
    historyMessages: [1, 200],
  },
  agentInvocations: { pollIntervalMs: [100, 600_000], timeoutMs: [1000, 120_000] },
  sweeps: {
    autoArchiveMinutes: [1, 1440],
    tracePruneMinutes: [1, 1440],
    shareExpiryMinutes: [1, 1440],
  },
  bot: { configPollIntervalMs: [1000, 3_600_000] },
};

// The values migration 0180 writes. Nothing falls back to them at runtime; the api tests
// write them again after they empty the database.
export function defaultJobSettings(): JobSettings {
  return {
    webhooks: {
      pollIntervalMs: 2000,
      batchSize: 20,
      timeoutMs: 10_000,
      maxAttempts: 8,
      disableThreshold: 20,
      leaseSeconds: 120,
      retentionDays: 30,
      cleanupIntervalMinutes: 10,
    },
    notifications: { batchSize: 20, maxAttempts: 5, leaseSeconds: 120 },
    imports: { pollIntervalMs: 3000 },
    agentRuns: { pollIntervalMs: 2000, maxAttempts: 3, leaseSeconds: 300 },
    agentChat: {
      leaseSeconds: 300,
      maxAttempts: 3,
      claimWaitMs: 25_000,
      claimPollMs: 500,
      streamPollMs: 300,
      historyMessages: 20,
    },
    agentInvocations: { pollIntervalMs: 1000, timeoutMs: 15_000 },
    sweeps: { autoArchiveMinutes: 60, tracePruneMinutes: 60, shareExpiryMinutes: 1 },
    bot: { configPollIntervalMs: 30_000 },
  };
}

// Merges a partial value over a full one, group by group.
export function mergeJobSettings(base: JobSettings, patch: JobSettingsPatch): JobSettings {
  const merged = { ...base };
  for (const group of Object.keys(base) as (keyof JobSettings)[]) {
    Object.assign(merged, { [group]: { ...base[group], ...patch[group] } });
  }
  return merged;
}

export async function getJobSettings(): Promise<JobSettings> {
  const stored = await getSetting<JobSettings>(JOB_SETTINGS_KEY);
  if (!stored) throw new Error('The job settings are missing: apply the database migrations');
  return stored;
}

// ── Values moved from the environment ──
// Releases before the job settings read these values from environment variables. Each
// service moves the ones it read into the job settings once, at its first start on this
// release, and records that it did in JOB_ENV_MOVED_KEY. The record is per service: the
// api, the worker and the bot each read their own variables. This block can be removed
// once instances have upgraded past this release.

type JobService = 'api' | 'worker' | 'bot';

const JOB_ENV_MOVED_KEY = 'jobsEnvMoved';

type JobPath = { [G in keyof JobSettings]: [G, keyof JobSettings[G]] }[keyof JobSettings];

interface LegacyVariable {
  service: JobService;
  // Where the value goes: a job setting, the instance's run time limit, or nowhere for a
  // variable whose setting is gone.
  path: JobPath | 'runTimeout' | null;
  // Turns the old value into the setting's unit.
  convert?: (value: number) => number;
}

const toMinutes = (ms: number) => Math.round(ms / 60_000);

const LEGACY_VARIABLES: Record<string, LegacyVariable> = {
  AGENT_RUN_TIMEOUT_MS: { service: 'api', path: 'runTimeout' },
  AGENT_RUN_POLL_INTERVAL_MS: { service: 'api', path: ['agentRuns', 'pollIntervalMs'] },
  AGENT_RUN_MAX_ATTEMPTS: { service: 'api', path: ['agentRuns', 'maxAttempts'] },
  AGENT_RUN_LEASE_SECONDS: { service: 'api', path: ['agentRuns', 'leaseSeconds'] },
  AUTO_ARCHIVE_INTERVAL_MS: {
    service: 'api',
    path: ['sweeps', 'autoArchiveMinutes'],
    convert: toMinutes,
  },
  AGENT_TRACE_PRUNE_INTERVAL_MS: {
    service: 'api',
    path: ['sweeps', 'tracePruneMinutes'],
    convert: toMinutes,
  },
  SHARE_EXPIRY_INTERVAL_MS: {
    service: 'api',
    path: ['sweeps', 'shareExpiryMinutes'],
    convert: toMinutes,
  },
  AGENT_CHAT_LEASE_SECONDS: { service: 'api', path: ['agentChat', 'leaseSeconds'] },
  AGENT_CHAT_MAX_ATTEMPTS: { service: 'api', path: ['agentChat', 'maxAttempts'] },
  AGENT_CHAT_CLAIM_WAIT_MS: { service: 'api', path: ['agentChat', 'claimWaitMs'] },
  AGENT_CHAT_CLAIM_POLL_MS: { service: 'api', path: ['agentChat', 'claimPollMs'] },
  AGENT_CHAT_STREAM_POLL_MS: { service: 'api', path: ['agentChat', 'streamPollMs'] },
  AGENT_CHAT_HISTORY_MESSAGES: { service: 'api', path: ['agentChat', 'historyMessages'] },
  AGENT_INVOCATION_POLL_INTERVAL_MS: {
    service: 'api',
    path: ['agentInvocations', 'pollIntervalMs'],
  },
  AGENT_INVOCATION_TIMEOUT_MS: { service: 'api', path: ['agentInvocations', 'timeoutMs'] },
  WEBHOOK_POLL_INTERVAL_MS: { service: 'worker', path: ['webhooks', 'pollIntervalMs'] },
  WEBHOOK_BATCH_SIZE: { service: 'worker', path: ['webhooks', 'batchSize'] },
  WEBHOOK_TIMEOUT_MS: { service: 'worker', path: ['webhooks', 'timeoutMs'] },
  WEBHOOK_MAX_ATTEMPTS: { service: 'worker', path: ['webhooks', 'maxAttempts'] },
  WEBHOOK_DISABLE_THRESHOLD: { service: 'worker', path: ['webhooks', 'disableThreshold'] },
  WEBHOOK_LEASE_SECONDS: { service: 'worker', path: ['webhooks', 'leaseSeconds'] },
  WEBHOOK_CLEANUP_DAYS: { service: 'worker', path: ['webhooks', 'retentionDays'] },
  // The cleanup ran once every N passes of the webhook poll.
  WEBHOOK_CLEANUP_EVERY_TICKS: {
    service: 'worker',
    path: ['webhooks', 'cleanupIntervalMinutes'],
    convert: (ticks) => toMinutes(ticks * (legacyValue('WEBHOOK_POLL_INTERVAL_MS') ?? 2000)),
  },
  NOTIFICATION_BATCH_SIZE: { service: 'worker', path: ['notifications', 'batchSize'] },
  NOTIFICATION_MAX_ATTEMPTS: { service: 'worker', path: ['notifications', 'maxAttempts'] },
  NOTIFICATION_LEASE_SECONDS: { service: 'worker', path: ['notifications', 'leaseSeconds'] },
  IMPORT_POLL_INTERVAL_MS: { service: 'worker', path: ['imports', 'pollIntervalMs'] },
  BOT_CONFIG_POLL_INTERVAL_MS: { service: 'bot', path: ['bot', 'configPollIntervalMs'] },
  BOT_CONFIG_RETRY_INTERVAL_MS: { service: 'bot', path: null },
};

// The value as the old code read it: a positive number, anything else ignored.
function legacyValue(name: string): number | null {
  const value = Number(process.env[name]);
  return process.env[name] && Number.isFinite(value) && value > 0 ? value : null;
}

function clamp(value: number, [min, max]: Bounds): number {
  return Math.min(Math.max(Math.round(value), min), max);
}

// The variables of one service that are set, with the job setting value each turns into.
function legacyPatch(service: JobService): { names: string[]; patch: JobSettingsPatch } {
  const names: string[] = [];
  const patch: Record<string, Record<string, number>> = {};
  for (const [name, variable] of Object.entries(LEGACY_VARIABLES)) {
    const value = variable.service === service ? legacyValue(name) : null;
    if (value === null) continue;
    names.push(name);
    if (!Array.isArray(variable.path)) continue;
    const [group, key] = variable.path;
    const bounds = (JOB_SETTING_BOUNDS[group] as Record<string, Bounds>)[key as string]!;
    (patch[group] ??= {})[key as string] = clamp(variable.convert?.(value) ?? value, bounds);
  }
  return { names, patch: patch as JobSettingsPatch };
}

// Moves the service's variables into the job settings, unless it already did. Throws while
// the job settings row does not exist yet, so the caller retries after the migrations.
export async function moveJobEnv(service: JobService): Promise<void> {
  const { names, patch } = legacyPatch(service);
  const moved = await db.transaction(async (tx): Promise<Set<string>> => {
    const [jobs] = await tx
      .select({ value: appSetting.value })
      .from(appSetting)
      .where(eq(appSetting.key, JOB_SETTINGS_KEY))
      .for('update');
    if (!jobs) throw new Error('The job settings are missing: apply the database migrations');
    const [record] = await tx
      .select({ value: appSetting.value })
      .from(appSetting)
      .where(eq(appSetting.key, JOB_ENV_MOVED_KEY));
    const done = (record?.value as JobService[] | undefined) ?? [];
    if (done.includes(service)) return new Set();
    await tx
      .update(appSetting)
      .set({
        value: mergeJobSettings(jobs.value as JobSettings, patch),
        updatedAt: sql`now()`,
      })
      .where(eq(appSetting.key, JOB_SETTINGS_KEY));
    const runTimeoutMoved = names.includes('AGENT_RUN_TIMEOUT_MS') && (await moveRunTimeout(tx));
    await tx
      .insert(appSetting)
      .values({ key: JOB_ENV_MOVED_KEY, value: [...done, service] })
      .onConflictDoUpdate({ target: appSetting.key, set: { value: [...done, service] } });
    return new Set(
      names.filter((name) => {
        const { path } = LEGACY_VARIABLES[name]!;
        return Array.isArray(path) || (path === 'runTimeout' && runTimeoutMoved);
      }),
    );
  });
  for (const name of names) {
    console.warn(
      moved.has(name)
        ? `[${service}] ${name} was moved to god mode. Remove it from the environment.`
        : `[${service}] ${name} is no longer read. Set the value in god mode.`,
    );
  }
}

// AGENT_RUN_TIMEOUT_MS set the instance's run time limit until one was saved in god mode.
// The limit is in the api's agent settings (app_setting key 'agents'), as seconds from 10
// to 3600.
async function moveRunTimeout(tx: DbExecutor): Promise<boolean> {
  const [agents] = await tx
    .select({ value: appSetting.value })
    .from(appSetting)
    .where(eq(appSetting.key, 'agents'));
  const stored = (agents?.value ?? {}) as Record<string, unknown>;
  if ('maxRunSeconds' in stored) return false;
  const value = {
    ...stored,
    maxRunSeconds: clamp(legacyValue('AGENT_RUN_TIMEOUT_MS')! / 1000, [10, 3600]),
  };
  await tx
    .insert(appSetting)
    .values({ key: 'agents', value })
    .onConflictDoUpdate({ target: appSetting.key, set: { value, updatedAt: sql`now()` } });
  return true;
}

// Runs moveJobEnv until it succeeds, without holding up the service's start.
export function startJobEnvMove(service: JobService): void {
  const attempt = () => {
    moveJobEnv(service).catch((error: unknown) => {
      console.error(`[${service}] could not move the job settings from the environment:`, error);
      setTimeout(attempt, 5000).unref();
    });
  };
  attempt();
}
