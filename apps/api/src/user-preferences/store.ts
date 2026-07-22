import { db, userPreference } from '@repo/db';
import { eq, sql } from 'drizzle-orm';

// A user's own interface preferences, held per account so the same choices apply on
// every device. One row per user; absent means nothing was changed yet and the
// defaults below apply, so a read never fails. Timestamps stay UTC everywhere in the
// API — `timezone` only tells the web app which zone to render them in.

export const THEMES = ['light', 'dark', 'system'] as const;
export const ISSUE_OPEN_MODES = ['panel', 'page'] as const;
export const START_PAGES = ['inbox', 'dashboard', 'work-items', 'initiatives', 'ai-chat'] as const;

export type Theme = (typeof THEMES)[number];
export type IssueOpenMode = (typeof ISSUE_OPEN_MODES)[number];
export type StartPage = (typeof START_PAGES)[number];

export interface UserPreferenceDto {
  timezone: string;
  theme: Theme;
  issueOpenMode: IssueOpenMode;
  startPage: StartPage;
  // Keeps the floating AI chat button on screen from the start, with the chat
  // window collapsed.
  showChatByDefault: boolean;
  // The project the user was in last, or null before they opened one. The app root
  // reopens it; a deleted project clears it through the FK.
  lastProjectId: number | null;
  // The keyboard shortcuts this user rebound, as { commandId: combo }. Only the
  // changed ones are stored; the rest come from the instance settings and then the
  // web app's built-in bindings.
  hotkeys: Record<string, string>;
}

export type UserPreferencePatch = Partial<UserPreferenceDto>;

export function defaults(): UserPreferenceDto {
  return {
    timezone: 'UTC',
    theme: 'system',
    issueOpenMode: 'panel',
    startPage: 'work-items',
    showChatByDefault: false,
    lastProjectId: null,
    hotkeys: {},
  };
}

// Whether a string is an IANA zone this runtime knows ('Europe/Berlin', 'UTC').
// Intl throws a RangeError for anything it cannot resolve.
export function isValidTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function toDto(row: {
  timezone: string;
  theme: string;
  issueOpenMode: string;
  startPage: string;
  showChatByDefault: boolean;
  lastProjectId: number | null;
  hotkeys: Record<string, string> | null;
}): UserPreferenceDto {
  return {
    timezone: row.timezone,
    theme: row.theme as Theme,
    issueOpenMode: row.issueOpenMode as IssueOpenMode,
    startPage: row.startPage as StartPage,
    showChatByDefault: row.showChatByDefault,
    lastProjectId: row.lastProjectId,
    hotkeys: row.hotkeys ?? {},
  };
}

// A user's preferences, or the defaults when they have no row yet.
export async function getPreferences(userId: string): Promise<UserPreferenceDto> {
  const rows = await db
    .select({
      timezone: userPreference.timezone,
      theme: userPreference.theme,
      issueOpenMode: userPreference.issueOpenMode,
      startPage: userPreference.startPage,
      showChatByDefault: userPreference.showChatByDefault,
      lastProjectId: userPreference.lastProjectId,
      hotkeys: userPreference.hotkeys,
    })
    .from(userPreference)
    .where(eq(userPreference.userId, userId));
  return rows[0] ? toDto(rows[0]) : defaults();
}

// Applies a partial update and returns the full result. Fields left out keep their
// stored value, or take the default when there is no row yet.
export async function updatePreferences(
  userId: string,
  patch: UserPreferencePatch,
): Promise<UserPreferenceDto> {
  const next = { ...(await getPreferences(userId)), ...patch };
  await db
    .insert(userPreference)
    .values({ userId, ...next })
    .onConflictDoUpdate({
      target: userPreference.userId,
      set: { ...next, updatedAt: sql`now()` },
    });
  return next;
}
