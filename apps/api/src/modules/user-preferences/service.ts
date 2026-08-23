import { db, userPreference } from '@repo/db';
import { eq, sql } from 'drizzle-orm';
import { DEFAULT_LOCALE, type Locale } from './locale';

// A user's own interface preferences, held per account so the same choices apply on
// every device. One row per user; absent means nothing was changed yet and the
// request's browser-localized defaults apply, so a read never fails. Timestamps stay
// UTC everywhere in the API — `timezone` only tells the web app which zone to render them in.

// The zone a user reads timestamps in until they choose one.
export const DEFAULT_TIMEZONE = 'UTC';

export const THEMES = ['light', 'dark', 'system'] as const;
export const ISSUE_OPEN_MODES = ['panel', 'page'] as const;
export const START_PAGES = ['inbox', 'dashboard', 'work-items', 'initiatives'] as const;
export const ISSUE_STATS_VIEWS = ['compact', 'timeline'] as const;
export const ISSUE_ACTIVITY_VIEWS = ['flat', 'grouped'] as const;

export type Theme = (typeof THEMES)[number];
export type IssueOpenMode = (typeof ISSUE_OPEN_MODES)[number];
export type StartPage = (typeof START_PAGES)[number];
export type IssueStatsView = (typeof ISSUE_STATS_VIEWS)[number];
export type IssueActivityView = (typeof ISSUE_ACTIVITY_VIEWS)[number];

export interface UserPreferenceDto {
  timezone: string;
  // The interface language, also used for this user's emails and bot messages.
  locale: Locale;
  theme: Theme;
  issueOpenMode: IssueOpenMode;
  startPage: StartPage;
  // Keeps the floating AI chat button on screen from the start, with the chat
  // window collapsed.
  showChatByDefault: boolean;
  // How the status stats section of an issue starts out, and the shape the activity
  // log below it starts in. Switching either on an issue is not stored.
  issueStatsOpen: boolean;
  issueStatsView: IssueStatsView;
  issueActivityView: IssueActivityView;
  // Whether the user is subscribed to the issues they create, are assigned, comment
  // on or are mentioned in. Off means they only ever subscribe by hand.
  autoWatch: boolean;
  // The project the user was in last, or null before they opened one. The app root
  // reopens it; a deleted project clears it through the FK.
  lastProjectId: number | null;
  // The keyboard shortcuts this user rebound, as { commandId: combo }. Only the
  // changed ones are stored; the rest come from the instance settings and then the
  // web app's built-in bindings.
  hotkeys: Record<string, string>;
}

export type UserPreferencePatch = Partial<UserPreferenceDto>;

export function defaults(locale: Locale = DEFAULT_LOCALE): UserPreferenceDto {
  return {
    timezone: DEFAULT_TIMEZONE,
    locale,
    theme: 'system',
    issueOpenMode: 'panel',
    startPage: 'work-items',
    showChatByDefault: false,
    issueStatsOpen: true,
    issueStatsView: 'compact',
    issueActivityView: 'flat',
    autoWatch: true,
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
  locale: string;
  theme: string;
  issueOpenMode: string;
  startPage: string;
  showChatByDefault: boolean;
  issueStatsOpen: boolean;
  issueStatsView: string;
  issueActivityView: string;
  autoWatch: boolean;
  lastProjectId: number | null;
  hotkeys: Record<string, string> | null;
}): UserPreferenceDto {
  return {
    timezone: row.timezone,
    locale: row.locale as Locale,
    theme: row.theme as Theme,
    issueOpenMode: row.issueOpenMode as IssueOpenMode,
    startPage: row.startPage as StartPage,
    showChatByDefault: row.showChatByDefault,
    issueStatsOpen: row.issueStatsOpen,
    issueStatsView: row.issueStatsView as IssueStatsView,
    issueActivityView: row.issueActivityView as IssueActivityView,
    autoWatch: row.autoWatch,
    lastProjectId: row.lastProjectId,
    hotkeys: row.hotkeys ?? {},
  };
}

// A user's preferences, or the defaults when they have no row yet.
export async function getPreferences(
  userId: string,
  defaultLocale: Locale = DEFAULT_LOCALE,
): Promise<UserPreferenceDto> {
  const rows = await db
    .select({
      timezone: userPreference.timezone,
      locale: userPreference.locale,
      theme: userPreference.theme,
      issueOpenMode: userPreference.issueOpenMode,
      startPage: userPreference.startPage,
      showChatByDefault: userPreference.showChatByDefault,
      issueStatsOpen: userPreference.issueStatsOpen,
      issueStatsView: userPreference.issueStatsView,
      issueActivityView: userPreference.issueActivityView,
      autoWatch: userPreference.autoWatch,
      lastProjectId: userPreference.lastProjectId,
      hotkeys: userPreference.hotkeys,
    })
    .from(userPreference)
    .where(eq(userPreference.userId, userId));
  return rows[0] ? toDto(rows[0]) : defaults(defaultLocale);
}

// Applies a partial update and returns the full result. Fields left out keep their
// stored value, or take the default when there is no row yet.
export async function updatePreferences(
  userId: string,
  patch: UserPreferencePatch,
  defaultLocale: Locale = DEFAULT_LOCALE,
): Promise<UserPreferenceDto> {
  const next = { ...(await getPreferences(userId, defaultLocale)), ...patch };
  await db
    .insert(userPreference)
    .values({ userId, ...next })
    .onConflictDoUpdate({
      target: userPreference.userId,
      set: { ...next, updatedAt: sql`now()` },
    });
  return next;
}
