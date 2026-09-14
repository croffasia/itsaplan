export const COMPETITOR_EVENT_KINDS = [
  'new_post',
  'followers_jump',
  'followers_drop',
  'profile_changed',
  'went_quiet',
  'check_failed',
] as const;
export type CompetitorEventKind = (typeof COMPETITOR_EVENT_KINDS)[number];

// One reading of an account, as a provider returns it. Every field is optional:
// what a platform exposes differs, and a provider fills in what it can.
export interface SnapshotInput {
  followers?: number | null;
  following?: number | null;
  posts?: number | null;
  displayName?: string | null;
  biography?: string | null;
  avatarUrl?: string | null;
  latestPostId?: string | null;
  latestPostUrl?: string | null;
  latestPostAt?: Date | null;
  latestPostCaption?: string | null;
}

export interface DetectedEvent {
  kind: CompetitorEventKind;
  summary: string;
  detail: Record<string, unknown>;
  postUrl?: string | null;
}

// A follower change smaller than this is noise — accounts drift by a few every
// hour. Both a percentage and an absolute floor, so a small account does not fire
// on +3 and a large one does not stay silent through a real jump.
export const FOLLOWER_CHANGE_PERCENT = 2;
export const FOLLOWER_CHANGE_MINIMUM = 25;

// An account that has not posted for this long has gone quiet, which is worth
// knowing about a rival.
export const QUIET_AFTER_DAYS = 14;

function significantFollowerChange(before: number, after: number): boolean {
  const delta = Math.abs(after - before);
  if (delta < FOLLOWER_CHANGE_MINIMUM) return false;
  if (before === 0) return true;
  return (delta / before) * 100 >= FOLLOWER_CHANGE_PERCENT;
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

// Compares the reading just taken against the one before it and returns what is
// worth alerting on. Pure, so the rules are testable without a database or a
// provider. `previous` is null on the very first check: nothing is an alert then,
// because everything would look new.
export function detectEvents(
  handle: string,
  previous: SnapshotInput | null,
  current: SnapshotInput,
  now = new Date(),
): DetectedEvent[] {
  if (!previous) return [];
  const events: DetectedEvent[] = [];

  if (
    current.latestPostId &&
    previous.latestPostId &&
    current.latestPostId !== previous.latestPostId
  ) {
    const caption = current.latestPostCaption?.trim();
    events.push({
      kind: 'new_post',
      summary: caption
        ? `@${handle} posted: ${truncate(caption, 120)}`
        : `@${handle} posted something new`,
      detail: { postId: current.latestPostId, postedAt: current.latestPostAt?.toISOString() },
      postUrl: current.latestPostUrl ?? null,
    });
  }

  if (
    typeof previous.followers === 'number' &&
    typeof current.followers === 'number' &&
    significantFollowerChange(previous.followers, current.followers)
  ) {
    const rising = current.followers > previous.followers;
    const delta = current.followers - previous.followers;
    events.push({
      kind: rising ? 'followers_jump' : 'followers_drop',
      summary: `@${handle} ${rising ? 'gained' : 'lost'} ${Math.abs(delta)} followers (${previous.followers} → ${current.followers})`,
      detail: { before: previous.followers, after: current.followers, delta },
    });
  }

  const changed: string[] = [];
  if (previous.displayName != null && current.displayName != null) {
    if (previous.displayName !== current.displayName) changed.push('name');
  }
  if (previous.biography != null && current.biography != null) {
    if (previous.biography !== current.biography) changed.push('bio');
  }
  if (changed.length > 0) {
    events.push({
      kind: 'profile_changed',
      summary: `@${handle} changed its ${changed.join(' and ')}`,
      detail: {
        name: changed.includes('name')
          ? { before: previous.displayName, after: current.displayName }
          : undefined,
        bio: changed.includes('bio')
          ? { before: previous.biography, after: current.biography }
          : undefined,
      },
    });
  }

  // Only fires on the check that crosses the threshold, so it is reported once
  // rather than on every check while the account stays quiet.
  if (current.latestPostAt && previous.latestPostAt) {
    const quietMs = QUIET_AFTER_DAYS * 24 * 60 * 60 * 1000;
    const wasQuiet = now.getTime() - previous.latestPostAt.getTime() >= quietMs;
    const isQuiet = now.getTime() - current.latestPostAt.getTime() >= quietMs;
    if (isQuiet && !wasQuiet) {
      events.push({
        kind: 'went_quiet',
        summary: `@${handle} has not posted for ${QUIET_AFTER_DAYS} days`,
        detail: { lastPostAt: current.latestPostAt.toISOString() },
      });
    }
  }

  return events;
}
