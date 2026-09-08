import type { Locale } from '@/i18n/locales';
import { request } from '@/lib/api/core/client';
import type { HotkeyOverrides } from '@/lib/api/endpoints/settings';

// The signed-in user's interface preferences, held per account so they apply on
// every device. timezone is an IANA zone name the app renders stored UTC timestamps
// in; issueOpenMode decides whether a clicked issue opens in the side panel or on
// its own page; startPage is the section the app root lands on; showChatByDefault
// keeps the floating AI chat button on screen from the start; lastProjectId is the
// project the app root reopens (null until the user has opened one).
export type ThemePreference = 'light' | 'dark' | 'system';

export type IssueOpenMode = 'panel' | 'page';

export type StartPage = 'inbox' | 'dashboard' | 'work-items' | 'initiatives';

export type IssueStatsView = 'compact' | 'timeline';

export type IssueActivityView = 'flat' | 'grouped';

export interface AccountPreferences {
  timezone: string;
  // The interface language. Mirrored into the NEXT_LOCALE cookie, which is what the
  // server renders with; also the language of this user's emails and bot messages.
  locale: Locale;
  theme: ThemePreference;
  issueOpenMode: IssueOpenMode;
  startPage: StartPage;
  showChatByDefault: boolean;
  // How the status stats section of an issue starts out, and the shape its activity
  // log starts in. Switching either on an issue is not saved — it lasts as long as
  // that issue stays open.
  issueStatsOpen: boolean;
  issueStatsView: IssueStatsView;
  issueActivityView: IssueActivityView;
  // Whether the user is subscribed to the issues they create, are assigned, comment
  // on or are mentioned in. Off means they only ever subscribe by hand.
  autoWatch: boolean;
  lastProjectId: number | null;
  // The keyboard shortcuts this user rebound, as { commandId: combo }. Only the
  // changed ones; the rest come from the instance settings, then the built-in
  // bindings (see lib/hotkeys).
  hotkeys: HotkeyOverrides;
}

export type AccountPreferencesPatch = Partial<AccountPreferences>;

// The session user's own interface preferences, held per account. A read returns
// the defaults when nothing was saved; a write patches only the fields it carries.
export const getAccountPreferences = (locale: Locale) =>
  request<AccountPreferences>('/account/preferences', {
    headers: { 'Accept-Language': locale },
  });

export const updateAccountPreferences = (input: AccountPreferencesPatch, locale: Locale) =>
  request<AccountPreferences>('/account/preferences', {
    method: 'PATCH',
    headers: { 'Accept-Language': locale },
    body: JSON.stringify(input),
  });
