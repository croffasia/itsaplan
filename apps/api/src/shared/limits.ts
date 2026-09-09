import type { ProjectFeature } from './features';

// Ceilings on what one team may use, and the sections it may not use at all. A
// self-hosted instance has none: every number is 0, which reads as unlimited, and the
// checks that enforce them return before they count anything. The values come from a
// provider so a hosted build can install its own — reading a subscription instead of
// answering with the defaults — without touching the places that enforce them.

export interface Limits {
  // Teams one account may own. Counted against the owner, since a team being created
  // has nothing to count against yet.
  maxTeams: number;
  // People in a team. An agent's bot user does not take a seat.
  maxTeamMembers: number;
  // Runs of the team's agents in flight at once.
  maxConcurrentRuns: number;
  // Wall time one run gets before it is aborted.
  maxRunSeconds: number;
  // How close together an agent schedule may fire.
  minScheduleIntervalSeconds: number;
  // Stored attachment bytes across the team's projects.
  maxStorageBytes: number;
  // Days the traces of the team's agent runs are kept for. 0 means the instance
  // setting applies, which is what a self-hosted instance answers with; a hosted
  // build gives a team its own window through the provider.
  maxTraceRetentionDays: number;
  // Project sections the team cannot use. A blocked one reads as off however its
  // project has it stored, and cannot be turned back on.
  blockedFeatures: ProjectFeature[];
}

// What a limit is counted against: the team for everything it owns, the account for
// creating a team.
export type LimitScope = { teamId: number } | { ownerUserId: string };

// What a self-hosted instance answers with, and the base a test or a hosted provider
// overrides fields on.
export const NO_LIMITS: Limits = {
  maxTeams: 0,
  maxTeamMembers: 0,
  maxConcurrentRuns: 0,
  maxRunSeconds: 0,
  minScheduleIntervalSeconds: 0,
  maxStorageBytes: 0,
  maxTraceRetentionDays: 0,
  blockedFeatures: [],
};

let provider: (scope: LimitScope) => Promise<Limits> = async () => NO_LIMITS;

export function setLimitsProvider(next: (scope: LimitScope) => Promise<Limits>): void {
  provider = next;
}

export function getLimits(scope: LimitScope): Promise<Limits> {
  return provider(scope);
}
