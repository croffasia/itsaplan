'use client';

import { useState } from 'react';
import type { AccountPreferencesPatch, IssueOpenMode, StartPage, ThemePreference } from '@/lib/api';
import {
  useAccountPreferencesQuery,
  useUpdateAccountPreferences,
  PREFERENCE_DEFAULTS,
} from '@/services/preferences.service';
import FullPageView from '@/components/common/page/FullPageView';
import { Switch } from '@/components/ui/switch';
import AccountPreferenceRow from './components/preferences/AccountPreferenceRow';
import AccountPreferenceSelect from './components/preferences/AccountPreferenceSelect';
import AccountPreferencesSection from './components/preferences/AccountPreferencesSection';
import AccountPreferencesTimezone from './components/preferences/AccountPreferencesTimezone';
import AccountHotkeys from './components/preferences/AccountHotkeys';
import AccountPreferencesSaveState from './components/preferences/AccountPreferencesSaveState';

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'Match system' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const ISSUE_OPEN_OPTIONS: { value: IssueOpenMode; label: string }[] = [
  { value: 'panel', label: 'Side panel' },
  { value: 'page', label: 'Full page' },
];

const START_PAGE_OPTIONS: { value: StartPage; label: string }[] = [
  { value: 'work-items', label: 'Work items' },
  { value: 'inbox', label: 'Inbox' },
  { value: 'dashboard', label: 'Dashboards' },
  { value: 'initiatives', label: 'Initiatives' },
  { value: 'ai-chat', label: 'AI chat' },
];

// Personal interface preferences (/account/preferences). Each choice saves as soon
// as it is made and applies on every device the user signs in from.
export default function AccountPreferencesPage() {
  const { data, isPending } = useAccountPreferencesQuery();
  const update = useUpdateAccountPreferences();
  const prefs = data ?? PREFERENCE_DEFAULTS;
  // Only the first load blocks the controls. A save in flight is reported in the
  // header instead of freezing the page, so two changes in a row are possible.
  const disabled = isPending;
  // The moment of the last successful save, which the header reports back.
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const save = (patch: AccountPreferencesPatch) =>
    update.mutate(patch, { onSuccess: () => setSavedAt(Date.now()) });

  return (
    <FullPageView
      label="Preferences"
      title="Preferences"
      description="How the app looks and behaves for you. Every change saves right away and applies wherever you sign in."
      actions={<AccountPreferencesSaveState saving={update.isPending} savedAt={savedAt} />}
    >
      <AccountPreferencesSection title="Appearance">
        <AccountPreferenceRow
          label="Theme"
          description="Match system follows your operating system setting."
        >
          <AccountPreferenceSelect
            value={prefs.theme}
            options={THEME_OPTIONS}
            onChange={(theme) => save({ theme })}
            disabled={disabled}
          />
        </AccountPreferenceRow>
      </AccountPreferencesSection>

      <AccountPreferencesSection
        title="Date and time"
        description="Timestamps are stored in UTC and shown in the zone you pick here."
      >
        <AccountPreferenceRow label="Timezone" description="Pick the zone you work in.">
          <AccountPreferencesTimezone
            value={prefs.timezone}
            onChange={(timezone) => save({ timezone })}
            disabled={disabled}
          />
        </AccountPreferenceRow>
      </AccountPreferencesSection>

      <AccountPreferencesSection
        title="Navigation"
        description="Where the app takes you, and how issues open."
      >
        <AccountPreferenceRow
          label="Open issues in"
          description="What happens when you click an issue on a board, table, calendar, or timeline."
        >
          <AccountPreferenceSelect
            value={prefs.issueOpenMode}
            options={ISSUE_OPEN_OPTIONS}
            onChange={(issueOpenMode) => save({ issueOpenMode })}
            disabled={disabled}
          />
        </AccountPreferenceRow>
        <AccountPreferenceRow
          label="Start page"
          description="The section that opens when you enter the app, in your last active project."
        >
          <AccountPreferenceSelect
            value={prefs.startPage}
            options={START_PAGE_OPTIONS}
            onChange={(startPage) => save({ startPage })}
            disabled={disabled}
          />
        </AccountPreferenceRow>
      </AccountPreferencesSection>

      <AccountPreferencesSection title="AI chat">
        <AccountPreferenceRow
          label="Show chat by default"
          description="The chat button stays on screen in a project. The chat window opens only when you click it."
        >
          <Switch
            checked={prefs.showChatByDefault}
            onCheckedChange={(showChatByDefault) => save({ showChatByDefault })}
            disabled={disabled}
          />
        </AccountPreferenceRow>
      </AccountPreferencesSection>

      <AccountPreferencesSection
        title="Keyboard shortcuts"
        description="Press Change, then the keys you want. Reset takes a shortcut back to the one set for this instance."
      >
        {/* Only once the saved overrides are known: a rebinding recorded before they
            arrive would be built on an empty map and drop the ones already stored. */}
        {data && (
          <AccountHotkeys overrides={data.hotkeys} onChange={(hotkeys) => save({ hotkeys })} />
        )}
      </AccountPreferencesSection>
    </FullPageView>
  );
}
