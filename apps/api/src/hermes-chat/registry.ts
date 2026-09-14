export interface HermesAgentRoute {
  slug: string;
  profile: string;
  pathPrefix: string;
  apiKeyEnv: string;
  enabled: boolean;
}

const HERMES_AGENTS: Record<string, HermesAgentRoute> = {
  bob: {
    slug: 'bob',
    profile: 'default',
    pathPrefix: '/p/default',
    apiKeyEnv: 'HERMES_BOB_API_KEY',
    enabled: true,
  },
};

export function resolveHermesAgent(slug: string): HermesAgentRoute | null {
  const route = HERMES_AGENTS[slug];
  return route?.enabled ? route : null;
}
