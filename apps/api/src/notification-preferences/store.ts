import { db, userNotificationPreference } from '@repo/db';
import { and, eq, inArray, sql } from 'drizzle-orm';

// A member's own notification preferences for one project: for each issue event
// type, whether they want it by email and/or Telegram. One row per (user, project);
// absent means the member has not opted in and receives nothing (opt-in default).
// The project's provider credentials live separately in notification-settings, and
// which Telegram chat the member is reached at comes from the account they linked
// (telegram/store.ts), which is instance-wide. Here is only the per-user choice of
// events and channels.

// The issue events a member can subscribe to, matching the inbox notification types.
export const EVENT_KEYS = ['assigned', 'mentioned', 'commented', 'state_changed'] as const;
export type EventKey = (typeof EVENT_KEYS)[number];
export type EventToggles = Record<EventKey, boolean>;

export interface NotificationPreferenceDto {
  emailEvents: EventToggles;
  telegramEvents: EventToggles;
}

function emptyEvents(): EventToggles {
  return { assigned: false, mentioned: false, commented: false, state_changed: false };
}

function defaults(): NotificationPreferenceDto {
  return { emailEvents: emptyEvents(), telegramEvents: emptyEvents() };
}

// Normalizes the stored jsonb (possibly partial or empty {}) into a full EventToggles.
function toToggles(value: unknown): EventToggles {
  const o = (value ?? {}) as Partial<Record<EventKey, boolean>>;
  return {
    assigned: Boolean(o.assigned),
    mentioned: Boolean(o.mentioned),
    commented: Boolean(o.commented),
    state_changed: Boolean(o.state_changed),
  };
}

function toDto(row: { emailEvents: unknown; telegramEvents: unknown }): NotificationPreferenceDto {
  return {
    emailEvents: toToggles(row.emailEvents),
    telegramEvents: toToggles(row.telegramEvents),
  };
}

// A member's preferences for a project, or opt-in defaults (nothing enabled) when
// they have no row yet.
export async function getPreferences(
  userId: string,
  projectId: number,
): Promise<NotificationPreferenceDto> {
  const rows = await db
    .select({
      emailEvents: userNotificationPreference.emailEvents,
      telegramEvents: userNotificationPreference.telegramEvents,
    })
    .from(userNotificationPreference)
    .where(
      and(
        eq(userNotificationPreference.userId, userId),
        eq(userNotificationPreference.projectId, projectId),
      ),
    );
  return rows[0] ? toDto(rows[0]) : defaults();
}

// Upserts a member's preferences for a project and returns the normalized result.
export async function setPreferences(
  userId: string,
  projectId: number,
  input: NotificationPreferenceDto,
): Promise<NotificationPreferenceDto> {
  const values = { emailEvents: input.emailEvents, telegramEvents: input.telegramEvents };
  await db
    .insert(userNotificationPreference)
    .values({ userId, projectId, ...values })
    .onConflictDoUpdate({
      target: [userNotificationPreference.userId, userNotificationPreference.projectId],
      set: { ...values, updatedAt: sql`now()` },
    });
  return toDto(values);
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
    .select({
      userId: userNotificationPreference.userId,
      emailEvents: userNotificationPreference.emailEvents,
      telegramEvents: userNotificationPreference.telegramEvents,
    })
    .from(userNotificationPreference)
    .where(
      and(
        eq(userNotificationPreference.projectId, projectId),
        inArray(userNotificationPreference.userId, userIds),
      ),
    );
  return new Map(rows.map((r) => [r.userId, toDto(r)]));
}
