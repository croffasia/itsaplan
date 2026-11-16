import { db, userNotificationPreference } from '@repo/db';
import { and, eq, inArray, sql } from 'drizzle-orm';

// A member's own notification preferences for one project: for each issue event
// type, whether they want it by email, Telegram and/or Web Push. One row per (user,
// project); absent means the member has not opted in and receives nothing (opt-in
// default).

// The issue events a member can subscribe to, matching the inbox notification types.
export type EventKey = 'assigned' | 'mentioned' | 'commented' | 'state_changed' | 'reacted';
export type EventToggles = Record<EventKey, boolean>;

export interface NotificationPreferenceDto {
  emailEvents: EventToggles;
  telegramEvents: EventToggles;
  pushEvents: EventToggles;
}

// The body's shape: `reacted` is optional.
type EventTogglesInput = Omit<EventToggles, 'reacted'> & { reacted?: boolean };

export interface NotificationPreferenceInput {
  emailEvents: EventTogglesInput;
  telegramEvents: EventTogglesInput;
  // Left out, the stored ones are kept.
  pushEvents?: EventTogglesInput;
}

function emptyEvents(): EventToggles {
  return {
    assigned: false,
    mentioned: false,
    commented: false,
    state_changed: false,
    reacted: false,
  };
}

function defaults(): NotificationPreferenceDto {
  return { emailEvents: emptyEvents(), telegramEvents: emptyEvents(), pushEvents: emptyEvents() };
}

// Fills a set that may lack keys (stored jsonb, or a body from a client that predates
// a key) into a full EventToggles. A missing key reads as off.
function toToggles(value: unknown): EventToggles {
  const o = (value ?? {}) as Partial<Record<EventKey, boolean>>;
  return {
    assigned: Boolean(o.assigned),
    mentioned: Boolean(o.mentioned),
    commented: Boolean(o.commented),
    state_changed: Boolean(o.state_changed),
    reacted: Boolean(o.reacted),
  };
}

function toDto(row: {
  emailEvents: unknown;
  telegramEvents: unknown;
  pushEvents: unknown;
}): NotificationPreferenceDto {
  return {
    emailEvents: toToggles(row.emailEvents),
    telegramEvents: toToggles(row.telegramEvents),
    pushEvents: toToggles(row.pushEvents),
  };
}

const eventColumns = {
  emailEvents: userNotificationPreference.emailEvents,
  telegramEvents: userNotificationPreference.telegramEvents,
  pushEvents: userNotificationPreference.pushEvents,
};

// A member's preferences for a project, or opt-in defaults (nothing enabled) when
// they have no row yet.
export async function getPreferences(
  userId: string,
  projectId: number,
): Promise<NotificationPreferenceDto> {
  const rows = await db
    .select(eventColumns)
    .from(userNotificationPreference)
    .where(
      and(
        eq(userNotificationPreference.userId, userId),
        eq(userNotificationPreference.projectId, projectId),
      ),
    );
  return rows[0] ? toDto(rows[0]) : defaults();
}

// Upserts a member's preferences for a project and returns the stored result.
export async function setPreferences(
  userId: string,
  projectId: number,
  input: NotificationPreferenceInput,
): Promise<NotificationPreferenceDto> {
  const values = {
    emailEvents: toToggles(input.emailEvents),
    telegramEvents: toToggles(input.telegramEvents),
    ...(input.pushEvents ? { pushEvents: toToggles(input.pushEvents) } : {}),
  };
  const [row] = await db
    .insert(userNotificationPreference)
    .values({ userId, projectId, ...values })
    .onConflictDoUpdate({
      target: [userNotificationPreference.userId, userNotificationPreference.projectId],
      set: { ...values, updatedAt: sql`now()` },
    })
    .returning(eventColumns);
  return toDto(row!);
}

// Preferences for a set of members of one project, keyed by user id. Missing members
// (no row) are omitted; the caller treats them as opted out. Used by the outbound
// enqueue path to decide, per inbox row, which channels that member wants.
export async function getPreferencesForUsers(
  projectId: number,
  userIds: string[],
): Promise<Map<string, NotificationPreferenceDto>> {
  if (userIds.length === 0) return new Map();
  const rows = await db
    .select({ userId: userNotificationPreference.userId, ...eventColumns })
    .from(userNotificationPreference)
    .where(
      and(
        eq(userNotificationPreference.projectId, projectId),
        inArray(userNotificationPreference.userId, userIds),
      ),
    );
  return new Map(rows.map((r) => [r.userId, toDto(r)]));
}
