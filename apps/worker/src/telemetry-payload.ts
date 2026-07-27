// Shapes the daily telemetry snapshot. Pure, so the rules are unit-tested.
//
// Counts go out as buckets, never exact, and nothing here carries a name, key, title,
// address or email. See TELEMETRY.md.

export interface InstanceCounts {
  users: number;
  activeUsers30d: number;
  projects: number;
  issues: number;
  issuesCreated30d: number;
  agents: number;
  agentRuns30d: number;
  agentRunsFailed30d: number;
  webhookDeliveries30d: number;
  webhookDeliveriesFailed30d: number;
  hasInitiatives: boolean;
  hasNoteBoards: boolean;
  hasDashboards: boolean;
  hasCustomViews: boolean;
  hasCustomFields: boolean;
  hasLabelGroups: boolean;
  hasProjectActions: boolean;
  hasAttachments: boolean;
  hasAgentSchedules: boolean;
  hasWebhooks: boolean;
  hasApiKeys: boolean;
  hasMcpProject: boolean;
  hasEmail: boolean;
  hasGoogleOauth: boolean;
  hasTelegramBot: boolean;
  hasProjectIntegrations: boolean;
}

export interface PulseInput {
  instanceId: string;
  // Both 'YYYY-MM-DD' in UTC. installedDay is null when it cannot be read.
  day: string;
  installedDay: string | null;
  version: string;
  bunVersion: string;
  docker: boolean;
  // '<platform>/<arch>', e.g. 'linux/arm64'.
  platform: string;
  postgresMajor: number | null;
  counts: InstanceCounts;
}

// Upper bound of each bucket paired with its label; above the last one, OVERFLOW.
const BUCKETS: ReadonlyArray<readonly [number, string]> = [
  [0, '0'],
  [1, '1'],
  [5, '2-5'],
  [20, '6-20'],
  [100, '21-100'],
  [1000, '101-1000'],
  [10_000, '1001-10000'],
];

const OVERFLOW_BUCKET = '10000+';

export function bucket(count: number): string {
  for (const [max, label] of BUCKETS) {
    if (count <= max) return label;
  }
  return OVERFLOW_BUCKET;
}

// Null when nothing ran: reporting 0 there would hide broken instances behind idle
// ones once the rates are averaged.
export function failureRate(failed: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.round((failed / total) * 100) / 100;
}

export function buildPulse(input: PulseInput) {
  const c = input.counts;
  return {
    instanceId: input.instanceId,
    day: input.day,
    installedDay: input.installedDay,
    version: input.version,
    runtime: {
      bun: input.bunVersion,
      docker: input.docker,
      platform: input.platform,
      postgresMajor: input.postgresMajor,
    },
    scale: {
      users: bucket(c.users),
      activeUsers30d: bucket(c.activeUsers30d),
      projects: bucket(c.projects),
      issues: bucket(c.issues),
      issuesCreated30d: bucket(c.issuesCreated30d),
    },
    // Roles and issue types are absent: every project is seeded with both, so their
    // presence does not distinguish real use from the seed.
    features: {
      initiatives: c.hasInitiatives,
      noteBoards: c.hasNoteBoards,
      dashboards: c.hasDashboards,
      customViews: c.hasCustomViews,
      customFields: c.hasCustomFields,
      labelGroups: c.hasLabelGroups,
      projectActions: c.hasProjectActions,
      attachments: c.hasAttachments,
    },
    // Which are configured, never any part of the configuration.
    integrations: {
      email: c.hasEmail,
      googleOauth: c.hasGoogleOauth,
      telegramBot: c.hasTelegramBot,
      webhooks: c.hasWebhooks,
      apiKeys: c.hasApiKeys,
      mcp: c.hasMcpProject,
      projectIntegrations: c.hasProjectIntegrations,
    },
    ai: {
      agents: bucket(c.agents),
      runs30d: bucket(c.agentRuns30d),
      schedules: c.hasAgentSchedules,
    },
    health: {
      webhookFailureRate30d: failureRate(c.webhookDeliveriesFailed30d, c.webhookDeliveries30d),
      agentRunFailureRate30d: failureRate(c.agentRunsFailed30d, c.agentRuns30d),
    },
  };
}
