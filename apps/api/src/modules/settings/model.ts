import { t } from 'elysia';
import { JOB_SETTING_BOUNDS } from '@repo/db';
import { MAX_CONCURRENT_RUNS, MAX_RUN_SECONDS, MIN_RUN_SECONDS } from './service';

export const StorageSettingsSchema = t.Object({
  maxAttachmentMb: t.Number(),
  maxAvatarMb: t.Number(),
  attachmentMimeTypes: t.Array(t.String()),
  projectQuotaMb: t.Number(),
});

export const InviteSearchSchema = t.Object({ enabled: t.Boolean() });

export const ProjectDefaultsSchema = t.Object({
  mcpEnabled: t.Boolean(),
});

export const SharingSettingsSchema = t.Object({
  enabled: t.Boolean({
    description:
      'Whether public links work on this instance. Off closes every link until it is on again.',
  }),
});

export const AgentSettingsSchema = t.Object({
  traceRetentionDays: t.Integer({
    minimum: 0,
    maximum: 3650,
    description:
      'Days the traces of an agent run are kept for. 0 keeps them until they are deleted by hand.',
  }),
  maxRunSeconds: t.Integer({
    minimum: MIN_RUN_SECONDS,
    maximum: MAX_RUN_SECONDS,
    description:
      "Seconds one agent run may take before it is stopped and saved as failed. An agent's own limit cannot exceed it.",
  }),
  maxConcurrentRuns: t.Integer({
    minimum: 0,
    maximum: MAX_CONCURRENT_RUNS,
    description:
      'Runs of internal agents in flight at once across the instance; the rest wait in the ' +
      "queue. 0 sets no limit. A workspace's own limit cannot exceed it.",
  }),
});

const int = ([minimum, maximum]: readonly [number, number], description: string) =>
  t.Integer({ minimum, maximum, description });

const WebhookJobsSchema = t.Object({
  pollIntervalMs: int(
    JOB_SETTING_BOUNDS.webhooks.pollIntervalMs,
    'How often the worker looks for due webhook and notification deliveries.',
  ),
  batchSize: int(
    JOB_SETTING_BOUNDS.webhooks.batchSize,
    'Webhook deliveries taken and sent at once on one pass.',
  ),
  timeoutMs: int(
    JOB_SETTING_BOUNDS.webhooks.timeoutMs,
    'How long one webhook request may go without an answer.',
  ),
  maxAttempts: int(
    JOB_SETTING_BOUNDS.webhooks.maxAttempts,
    'Attempts before a webhook delivery is saved as failed.',
  ),
  disableThreshold: int(
    JOB_SETTING_BOUNDS.webhooks.disableThreshold,
    'Failed deliveries in a row before a webhook is turned off.',
  ),
  leaseSeconds: int(
    JOB_SETTING_BOUNDS.webhooks.leaseSeconds,
    'Seconds before a delivery left by a stopped worker is sent again. Longer than the timeout.',
  ),
  retentionDays: int(
    JOB_SETTING_BOUNDS.webhooks.retentionDays,
    'Days a delivered webhook stays in the delivery log.',
  ),
  cleanupIntervalMinutes: int(
    JOB_SETTING_BOUNDS.webhooks.cleanupIntervalMinutes,
    'How often old deliveries are deleted from the log.',
  ),
});

const NotificationJobsSchema = t.Object({
  batchSize: int(
    JOB_SETTING_BOUNDS.notifications.batchSize,
    'Notification deliveries taken and sent at once on one pass.',
  ),
  maxAttempts: int(
    JOB_SETTING_BOUNDS.notifications.maxAttempts,
    'Attempts before a notification is saved as failed.',
  ),
  leaseSeconds: int(
    JOB_SETTING_BOUNDS.notifications.leaseSeconds,
    'Seconds before a notification left by a stopped worker is sent again.',
  ),
});

const ImportJobsSchema = t.Object({
  pollIntervalMs: int(
    JOB_SETTING_BOUNDS.imports.pollIntervalMs,
    'How often the worker looks for an import to run.',
  ),
});

const AgentRunJobsSchema = t.Object({
  pollIntervalMs: int(
    JOB_SETTING_BOUNDS.agentRuns.pollIntervalMs,
    'How often the queue of agent runs and the due schedules are checked.',
  ),
  maxAttempts: int(
    JOB_SETTING_BOUNDS.agentRuns.maxAttempts,
    'Attempts before an agent run is saved as failed.',
  ),
  leaseSeconds: int(
    JOB_SETTING_BOUNDS.agentRuns.leaseSeconds,
    'Seconds before a run taken by a stopped process or runner is started again. An internal agent gets at least its run time limit.',
  ),
});

const AgentChatJobsSchema = t.Object({
  leaseSeconds: int(
    JOB_SETTING_BOUNDS.agentChat.leaseSeconds,
    'Seconds before an answer a runner left is handed out again.',
  ),
  maxAttempts: int(
    JOB_SETTING_BOUNDS.agentChat.maxAttempts,
    'Times an answer is handed to a runner before it is saved as failed.',
  ),
  claimWaitMs: int(
    JOB_SETTING_BOUNDS.agentChat.claimWaitMs,
    'How long a runner request waits for a chat message to answer.',
  ),
  claimPollMs: int(
    JOB_SETTING_BOUNDS.agentChat.claimPollMs,
    'How often that request checks for a message while it waits.',
  ),
  streamPollMs: int(
    JOB_SETTING_BOUNDS.agentChat.streamPollMs,
    'How often an open chat looks for new parts of the answer.',
  ),
  historyMessages: int(
    JOB_SETTING_BOUNDS.agentChat.historyMessages,
    'Earlier messages of the chat sent to the runner with a new one.',
  ),
});

const AgentInvocationJobsSchema = t.Object({
  pollIntervalMs: int(
    JOB_SETTING_BOUNDS.agentInvocations.pollIntervalMs,
    'How often work is looked for to send to agents with an invocation URL.',
  ),
  timeoutMs: int(
    JOB_SETTING_BOUNDS.agentInvocations.timeoutMs,
    'How long to wait for the invocation URL to answer. Shorter than the run and chat leases.',
  ),
});

const SweepJobsSchema = t.Object({
  autoArchiveMinutes: int(
    JOB_SETTING_BOUNDS.sweeps.autoArchiveMinutes,
    'How often stale issues are archived.',
  ),
  tracePruneMinutes: int(
    JOB_SETTING_BOUNDS.sweeps.tracePruneMinutes,
    'How often agent traces past their retention are deleted.',
  ),
  shareExpiryMinutes: int(
    JOB_SETTING_BOUNDS.sweeps.shareExpiryMinutes,
    'How often expired public links are closed.',
  ),
});

const BotJobsSchema = t.Object({
  configPollIntervalMs: int(
    JOB_SETTING_BOUNDS.bot.configPollIntervalMs,
    'How often the Telegram bot reads its settings again.',
  ),
});

export const JobSettingsSchema = t.Object({
  webhooks: WebhookJobsSchema,
  notifications: NotificationJobsSchema,
  imports: ImportJobsSchema,
  agentRuns: AgentRunJobsSchema,
  agentChat: AgentChatJobsSchema,
  agentInvocations: AgentInvocationJobsSchema,
  sweeps: SweepJobsSchema,
  bot: BotJobsSchema,
});

export const JobSettingsBody = t.Partial(
  t.Object({
    webhooks: t.Partial(WebhookJobsSchema),
    notifications: t.Partial(NotificationJobsSchema),
    imports: t.Partial(ImportJobsSchema),
    agentRuns: t.Partial(AgentRunJobsSchema),
    agentChat: t.Partial(AgentChatJobsSchema),
    agentInvocations: t.Partial(AgentInvocationJobsSchema),
    sweeps: t.Partial(SweepJobsSchema),
    bot: t.Partial(BotJobsSchema),
  }),
);

// A command id bound to a combination written as modifier tokens plus a key
// ('mod+k', 'n'). The set of commands lives in the web app (its lib/hotkeys), so
// the API checks the shape and stores the map as given.
export const HotkeyCombosSchema = t.Record(
  t.String({ pattern: '^[a-z][a-z0-9.-]{0,63}$' }),
  t.String({ pattern: '^(mod\\+|shift\\+|alt\\+)*[a-z0-9]{1,10}$' }),
);

export const EmbedSitesSchema = t.Object({
  origins: t.Array(t.String({ maxLength: 300 }), {
    maxItems: 50,
    description:
      'Sites that may show the public pages in a frame, as origins such as https://example.com.',
  }),
});

const ReleaseSchema = t.Object({
  tag: t.String(),
  version: t.String(),
  publishedAt: t.String(),
  url: t.Nullable(t.String()),
  notes: t.String(),
  notesFormat: t.UnionEnum(['html', 'markdown']),
});

export const UpdateStatusSchema = t.Object({
  currentVersion: t.String(),
  latestVersion: t.Nullable(t.String()),
  updateAvailable: t.Boolean(),
  checkedAt: t.Nullable(t.String()),
  releases: t.Array(ReleaseSchema),
});

export const VersionResponse = t.Object({ version: t.String() });

const RenameSchema = t.Object({ from: t.String(), to: t.String() });

// What migration 0115 did to this instance's data, as the migration recorded it.
const TeamsMigrationSchema = t.Object({
  version: t.Number(),
  teams: t.Array(
    t.Object({
      name: t.String(),
      projects: t.Array(t.Object({ key: t.String(), name: t.String() })),
    }),
  ),
  renamed: t.Record(t.String(), t.Array(RenameSchema)),
  merged: t.Object({ roles: t.Number(), agentTools: t.Number() }),
  movedInvites: t.Number(),
  droppedNotificationSettings: t.Array(t.String()),
});

const BackupSchema = t.Object({
  path: t.String(),
  sizeBytes: t.Number(),
  createdAt: t.String(),
  expiresAt: t.String(),
  migrations: t.Array(t.String()),
});

export const WhatsNewSchema = t.Object({
  version: t.String(),
  pending: t.Boolean(),
  releases: t.Array(ReleaseSchema),
  backup: t.Nullable(BackupSchema),
  migration: t.Nullable(TeamsMigrationSchema),
});
