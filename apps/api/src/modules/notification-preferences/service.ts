import {
  db,
  project,
  projectMember,
  team,
  userNotificationDefault,
  userNotificationPreference,
} from '@repo/db';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { HttpError } from '#shared/lib';
import { slackAppsByWorkspace } from '#modules/slack/service';

// A user's own notification preferences: for each issue event type, whether they want it
// by email, Telegram, Slack and/or Web Push. A project they set has a row of its own;
// every other project follows their defaults. Without either they receive nothing
// (opt-in).

// The issue events a member can subscribe to, matching the inbox notification types.
export type EventKey = 'assigned' | 'mentioned' | 'commented' | 'state_changed' | 'reacted';
export type EventToggles = Record<EventKey, boolean>;

export interface NotificationPreferenceDto {
  emailEvents: EventToggles;
  telegramEvents: EventToggles;
  slackEvents: EventToggles;
  pushEvents: EventToggles;
}

export interface ProjectPreferenceDto {
  id: number;
  name: string;
  team: { id: number; name: string };
  slackTeamId: string | null;
  // Null while the project follows the defaults.
  preferences: NotificationPreferenceDto | null;
}

export interface AccountNotificationPreferencesDto {
  defaults: NotificationPreferenceDto;
  projects: ProjectPreferenceDto[];
}

export interface AccountNotificationPreferencesInput {
  defaults?: NotificationPreferenceDto;
  resetProjects?: boolean;
  projects?: { projectId: number; preferences: NotificationPreferenceDto | null }[];
}

// The body's shape: `reacted` is optional.
type EventTogglesInput = Omit<EventToggles, 'reacted'> & { reacted?: boolean };

export interface ProjectPreferenceInput {
  emailEvents: EventTogglesInput;
  telegramEvents: EventTogglesInput;
  // Left out, what the project sends there now is kept.
  slackEvents?: EventTogglesInput;
  pushEvents?: EventTogglesInput;
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

function toDto(row?: {
  emailEvents: unknown;
  telegramEvents: unknown;
  slackEvents: unknown;
  pushEvents: unknown;
}): NotificationPreferenceDto {
  return {
    emailEvents: toToggles(row?.emailEvents),
    telegramEvents: toToggles(row?.telegramEvents),
    slackEvents: toToggles(row?.slackEvents),
    pushEvents: toToggles(row?.pushEvents),
  };
}

const eventColumns = {
  emailEvents: userNotificationPreference.emailEvents,
  telegramEvents: userNotificationPreference.telegramEvents,
  slackEvents: userNotificationPreference.slackEvents,
  pushEvents: userNotificationPreference.pushEvents,
};

const defaultColumns = {
  emailEvents: userNotificationDefault.emailEvents,
  telegramEvents: userNotificationDefault.telegramEvents,
  slackEvents: userNotificationDefault.slackEvents,
  pushEvents: userNotificationDefault.pushEvents,
};

// The defaults and every project the user is a member of, hidden ones included: those
// notify too. An archived project sends nothing.
export async function getAccountPreferences(
  userId: string,
): Promise<AccountNotificationPreferencesDto> {
  const [[defaults], rows] = await Promise.all([
    db
      .select(defaultColumns)
      .from(userNotificationDefault)
      .where(eq(userNotificationDefault.userId, userId)),
    db
      .select({
        id: project.id,
        name: project.name,
        teamId: team.id,
        teamName: team.name,
        workspaceId: team.workspaceId,
        preferences: eventColumns,
      })
      .from(projectMember)
      .innerJoin(project, eq(project.id, projectMember.projectId))
      .innerJoin(team, eq(team.id, project.teamId))
      .leftJoin(
        userNotificationPreference,
        and(
          eq(userNotificationPreference.projectId, project.id),
          eq(userNotificationPreference.userId, userId),
        ),
      )
      .where(and(eq(projectMember.userId, userId), isNull(project.archivedAt)))
      .orderBy(sql`lower(${team.name})`, team.id, sql`lower(${project.name})`, project.id),
  ]);
  const slackApps = await slackAppsByWorkspace([...new Set(rows.map((r) => r.workspaceId))]);
  return {
    defaults: toDto(defaults),
    projects: rows.map((row) => ({
      id: row.id,
      name: row.name,
      team: { id: row.teamId, name: row.teamName },
      slackTeamId: slackApps.get(row.workspaceId)?.slackTeamId ?? null,
      preferences: row.preferences && toDto(row.preferences),
    })),
  };
}

// Replaces the defaults and the settings of the listed projects, all or nothing.
export async function updateAccountPreferences(
  userId: string,
  { defaults, resetProjects, projects = [] }: AccountNotificationPreferencesInput,
): Promise<void> {
  const byProject = new Map(projects.map((p) => [p.projectId, p.preferences]));
  const projectIds = [...byProject.keys()];
  const following = projectIds.filter((id) => byProject.get(id) === null);
  const own = [...byProject].flatMap(([projectId, preferences]) =>
    preferences ? [{ userId, projectId, ...toDto(preferences) }] : [],
  );
  await db.transaction(async (tx) => {
    if (projectIds.length > 0) {
      const memberships = await tx
        .select({ projectId: projectMember.projectId })
        .from(projectMember)
        .innerJoin(project, eq(project.id, projectMember.projectId))
        .where(
          and(
            eq(projectMember.userId, userId),
            inArray(projectMember.projectId, projectIds),
            isNull(project.archivedAt),
          ),
        );
      if (memberships.length < projectIds.length) {
        throw new HttpError(
          403,
          'One of these projects is archived, or you are not a member of it',
        );
      }
    }
    if (defaults) {
      const values = toDto(defaults);
      await tx
        .insert(userNotificationDefault)
        .values({ userId, ...values })
        .onConflictDoUpdate({
          target: userNotificationDefault.userId,
          set: { ...values, updatedAt: sql`now()` },
        });
    }
    if (resetProjects) {
      await tx
        .delete(userNotificationPreference)
        .where(eq(userNotificationPreference.userId, userId));
    }
    if (following.length > 0) {
      await tx
        .delete(userNotificationPreference)
        .where(
          and(
            eq(userNotificationPreference.userId, userId),
            inArray(userNotificationPreference.projectId, following),
          ),
        );
    }
    if (own.length > 0) {
      await tx
        .insert(userNotificationPreference)
        .values(own)
        .onConflictDoUpdate({
          target: [userNotificationPreference.userId, userNotificationPreference.projectId],
          set: {
            emailEvents: sql`excluded.email_events`,
            telegramEvents: sql`excluded.telegram_events`,
            slackEvents: sql`excluded.slack_events`,
            pushEvents: sql`excluded.push_events`,
            updatedAt: sql`now()`,
          },
        });
    }
  });
}

// What a member gets from one project: its own settings, or the defaults it follows.
export async function getProjectPreferences(
  userId: string,
  projectId: number,
): Promise<NotificationPreferenceDto> {
  return (await getPreferencesForUsers(projectId, [userId])).get(userId) ?? toDto();
}

// Gives a project settings of its own and returns the stored result. A channel left out
// keeps what the project sends now.
export async function setProjectPreferences(
  userId: string,
  projectId: number,
  input: ProjectPreferenceInput,
): Promise<NotificationPreferenceDto> {
  const current = await getProjectPreferences(userId, projectId);
  const values = toDto({ ...current, ...input });
  await db
    .insert(userNotificationPreference)
    .values({ userId, projectId, ...values })
    .onConflictDoUpdate({
      target: [userNotificationPreference.userId, userNotificationPreference.projectId],
      set: { ...values, updatedAt: sql`now()` },
    });
  return values;
}

// What each of a set of members gets from one project, keyed by user id. Members with
// neither settings of the project nor defaults are omitted; the caller treats them as
// opted out. Used by the outbound enqueue path to decide, per inbox row, which channels
// that member wants.
export async function getPreferencesForUsers(
  projectId: number,
  userIds: string[],
): Promise<Map<string, NotificationPreferenceDto>> {
  if (userIds.length === 0) return new Map();
  const [defaults, own] = await Promise.all([
    db
      .select({ userId: userNotificationDefault.userId, ...defaultColumns })
      .from(userNotificationDefault)
      .where(inArray(userNotificationDefault.userId, userIds)),
    db
      .select({ userId: userNotificationPreference.userId, ...eventColumns })
      .from(userNotificationPreference)
      .where(
        and(
          eq(userNotificationPreference.projectId, projectId),
          inArray(userNotificationPreference.userId, userIds),
        ),
      ),
  ]);
  return new Map([...defaults, ...own].map((r) => [r.userId, toDto(r)]));
}
