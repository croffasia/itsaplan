// Shapes the daily telemetry snapshot. Pure, so the rules are unit-tested.
//
// Counts go out as buckets, never exact, and nothing here carries a name, key, title,
// address or email. The string lists (integration keys, git providers, locales) hold
// identifiers from a fixed catalogue, never anything an operator typed. See
// TELEMETRY.md.

export interface InstanceCounts {
  users: number;
  activeUsers30d: number;
  projects: number;
  issues: number;
  issuesCreated30d: number;
  attachmentMb: number;
  agents: number;
  internalAgents: number;
  externalAgents: number;
  agentRuns30d: number;
  agentRunsFailed30d: number;
  agentSkills: number;
  agentChats30d: number;
  webhookDeliveries30d: number;
  webhookDeliveriesFailed30d: number;
  hasAgentSchedules: boolean;
  hasActiveRunners: boolean;
  runByMention30d: boolean;
  runByDelegation30d: boolean;
  runBySchedule30d: boolean;
  runByManual30d: boolean;
  hasWebhooks: boolean;
  hasApiKeys: boolean;
  hasMcpProject: boolean;
  hasEmail: boolean;
  hasGoogleOauth: boolean;
  hasTelegramBot: boolean;
  hasProjectIntegrations: boolean;
  hasGit: boolean;
}

// Instance-wide authentication policy, as stored in app_setting.
export interface AuthPolicy {
  registration: 'open' | 'invite' | 'closed';
  emailVerification: boolean;
  magicLink: boolean;
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
  // Whether each feature was ever used, and whether it was used in the last 30 days.
  // Both maps carry the same keys.
  features: Record<string, boolean>;
  featuresUsed30d: Record<string, boolean>;
  // Whether at least one project switched an optional section off.
  featuresDisabled: Record<string, boolean>;
  // Catalogue keys of the integrations credentials are stored for, e.g. 'openai',
  // 'jina'. Never the credentials themselves.
  integrationKeys: string[];
  // Repository hosts that have delivered: 'github', 'gitlab', 'gitea', 'forgejo',
  // 'bitbucket'. Never a repository name.
  gitProviders: string[];
  auth: AuthPolicy;
  // Interface languages the users of this instance picked, e.g. 'en', 'ru'.
  locales: string[];
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
      attachmentMb: bucket(c.attachmentMb),
    },
    features: input.features,
    featuresUsed30d: input.featuresUsed30d,
    featuresDisabled: input.featuresDisabled,
    // Which are configured, never any part of the configuration.
    integrations: {
      email: c.hasEmail,
      googleOauth: c.hasGoogleOauth,
      telegramBot: c.hasTelegramBot,
      webhooks: c.hasWebhooks,
      apiKeys: c.hasApiKeys,
      mcp: c.hasMcpProject,
      projectIntegrations: c.hasProjectIntegrations,
      git: c.hasGit,
    },
    integrationKeys: input.integrationKeys,
    git: {
      enabled: c.hasGit,
      providers: input.gitProviders,
    },
    auth: input.auth,
    locales: input.locales,
    ai: {
      agents: bucket(c.agents),
      internal: bucket(c.internalAgents),
      external: bucket(c.externalAgents),
      runs30d: bucket(c.agentRuns30d),
      schedules: c.hasAgentSchedules,
      // An external agent whose runner polled in the last 30 days.
      activeRunners: c.hasActiveRunners,
      skills: bucket(c.agentSkills),
      chats30d: bucket(c.agentChats30d),
      // Which ways of starting a run are actually used.
      triggers: {
        mention: c.runByMention30d,
        delegation: c.runByDelegation30d,
        schedule: c.runBySchedule30d,
        manual: c.runByManual30d,
      },
    },
    health: {
      webhookFailureRate30d: failureRate(c.webhookDeliveriesFailed30d, c.webhookDeliveries30d),
      agentRunFailureRate30d: failureRate(c.agentRunsFailed30d, c.agentRuns30d),
    },
  };
}
