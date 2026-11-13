import type { JobSettings } from '@/lib/api/endpoints/god';

export type JobGroup = keyof JobSettings;

// A field as `group.key`, which is also its message key under `god.jobs`.
export type JobFieldPath = { [G in JobGroup]: `${G}.${keyof JobSettings[G] & string}` }[JobGroup];

// The values as typed, by field path.
export type JobForm = Record<JobFieldPath, string>;

export interface JobField {
  path: JobFieldPath;
  min: number;
  max: number;
}

type Bounds = [min: number, max: number];

// The ranges the api validates against, so an out-of-range value disables Save instead
// of coming back as a 400. Groups and fields are shown in this order.
const BOUNDS: { [G in JobGroup]: Record<keyof JobSettings[G], Bounds> } = {
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

export const JOB_GROUPS = Object.keys(BOUNDS) as JobGroup[];

export function jobFields(group: JobGroup): JobField[] {
  return Object.entries<Bounds>(BOUNDS[group]).map(([key, [min, max]]) => ({
    path: `${group}.${key}` as JobFieldPath,
    min,
    max,
  }));
}

const FIELDS = new Map(JOB_GROUPS.flatMap(jobFields).map((field) => [field.path, field]));

export const JOB_FIELD_PATHS = [...FIELDS.keys()];

export function toJobForm(settings: JobSettings): JobForm {
  const entries = Object.entries(settings).flatMap(([group, fields]) =>
    Object.entries<number>(fields).map(([key, value]) => [`${group}.${key}`, String(value)]),
  );
  return Object.fromEntries(entries) as JobForm;
}

// Call only on a form where every value passed `jobValue`.
export function toJobSettings(form: JobForm): JobSettings {
  const settings: Record<string, Record<string, number>> = {};
  for (const path of JOB_FIELD_PATHS) {
    const [group, key] = path.split('.');
    (settings[group] ??= {})[key] = Number(form[path]);
  }
  return settings as unknown as JobSettings;
}

// The typed value, or NaN while it is not a whole number in the field's range.
export function jobValue(form: JobForm, path: JobFieldPath): number {
  const { min, max } = FIELDS.get(path)!;
  const raw = form[path].trim();
  const n = raw === '' ? NaN : Number(raw);
  return Number.isInteger(n) && n >= min && n <= max ? n : NaN;
}

export function jobFormValid(form: JobForm): boolean {
  return JOB_FIELD_PATHS.every((path) => !Number.isNaN(jobValue(form, path)));
}

// A lease that ends before its request does hands the same work out twice, so the api
// refuses a lease in seconds that is not longer than the timeout in milliseconds.
export function leaseTooShort(form: JobForm, lease: JobFieldPath, timeout: JobFieldPath) {
  return jobValue(form, lease) * 1000 <= jobValue(form, timeout);
}
