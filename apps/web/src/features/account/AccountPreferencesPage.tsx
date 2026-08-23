'use client';

import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import type {
  AccountPreferencesPatch,
  IssueActivityView,
  IssueOpenMode,
  IssueStatsView,
  StartPage,
  ThemePreference,
} from '@/lib/api';
import { LOCALES, LOCALE_LABELS } from '@/i18n/locales';
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
import AccountPreferencesNav from './components/preferences/AccountPreferencesNav';
import AccountPreferencesSaveState from './components/preferences/AccountPreferencesSaveState';

const THEMES: ThemePreference[] = ['system', 'light', 'dark'];
const ISSUE_OPEN_MODES: IssueOpenMode[] = ['panel', 'page'];
const ISSUE_STATS_VIEWS: IssueStatsView[] = ['compact', 'timeline'];
const ISSUE_ACTIVITY_VIEWS: IssueActivityView[] = ['flat', 'grouped'];
const START_PAGES: StartPage[] = ['work-items', 'inbox', 'dashboard', 'initiatives'];

// Personal interface preferences (/account/preferences). Each choice saves as soon
// as it is made and applies on every device the user signs in from.
export default function AccountPreferencesPage() {
  const t = useTranslations('account.preferences');
  const { data, isPending } = useAccountPreferencesQuery();
  const update = useUpdateAccountPreferences();
  const prefs = data ?? PREFERENCE_DEFAULTS;
  // Only the first load blocks the controls. A save in flight is reported in the
  // header instead of freezing the page, so two changes in a row are possible.
  const disabled = isPending;

  const save = (patch: AccountPreferencesPatch) =>
    update.mutate(patch, { onSuccess: () => toast.success(t('saved')) });

  // The language list names each language in itself, so it is not translated.
  const localeOptions = LOCALES.map((value) => ({ value, label: LOCALE_LABELS[value] }));

  return (
    <FullPageView
      label={t('label')}
      title={t('title')}
      description={t('description')}
      actions={<AccountPreferencesSaveState saving={update.isPending} />}
      nav={<AccountPreferencesNav />}
    >
      <AccountPreferencesSection id="appearance" title={t('sections.appearance')}>
        <AccountPreferenceRow label={t('theme')} description={t('themeDescription')}>
          <AccountPreferenceSelect
            value={prefs.theme}
            options={THEMES.map((value) => ({ value, label: t(`themeOptions.${value}`) }))}
            onChange={(theme) => save({ theme })}
            disabled={disabled}
          />
        </AccountPreferenceRow>
        <AccountPreferenceRow label={t('language')} description={t('languageDescription')}>
          <AccountPreferenceSelect
            value={prefs.locale}
            options={localeOptions}
            onChange={(locale) => save({ locale })}
            disabled={disabled}
          />
        </AccountPreferenceRow>
      </AccountPreferencesSection>

      <AccountPreferencesSection
        id="date-and-time"
        title={t('sections.dateAndTime')}
        description={t('sections.dateAndTimeDescription')}
      >
        <AccountPreferenceRow label={t('timezone')} description={t('timezoneDescription')}>
          <AccountPreferencesTimezone
            value={prefs.timezone}
            onChange={(timezone) => save({ timezone })}
            disabled={disabled}
          />
        </AccountPreferenceRow>
      </AccountPreferencesSection>

      <AccountPreferencesSection
        id="navigation"
        title={t('sections.navigation')}
        description={t('sections.navigationDescription')}
      >
        <AccountPreferenceRow
          label={t('issueOpenMode')}
          description={t('issueOpenModeDescription')}
        >
          <AccountPreferenceSelect
            value={prefs.issueOpenMode}
            options={ISSUE_OPEN_MODES.map((value) => ({
              value,
              label: t(`issueOpenModeOptions.${value}`),
            }))}
            onChange={(issueOpenMode) => save({ issueOpenMode })}
            disabled={disabled}
          />
        </AccountPreferenceRow>
        <AccountPreferenceRow label={t('startPage')} description={t('startPageDescription')}>
          <AccountPreferenceSelect
            value={prefs.startPage}
            options={START_PAGES.map((value) => ({
              value,
              label: t(`startPageOptions.${value}`),
            }))}
            onChange={(startPage) => save({ startPage })}
            disabled={disabled}
          />
        </AccountPreferenceRow>
      </AccountPreferencesSection>

      <AccountPreferencesSection
        id="issue-settings"
        title={t('sections.issueSettings')}
        description={t('sections.issueSettingsDescription')}
      >
        <AccountPreferenceRow label={t('showStats')} description={t('showStatsDescription')}>
          <Switch
            checked={prefs.issueStatsOpen}
            onCheckedChange={(issueStatsOpen) => save({ issueStatsOpen })}
            disabled={disabled}
          />
        </AccountPreferenceRow>
        <AccountPreferenceRow label={t('statsView')} description={t('statsViewDescription')}>
          <AccountPreferenceSelect
            value={prefs.issueStatsView}
            options={ISSUE_STATS_VIEWS.map((value) => ({
              value,
              label: t(`statsViewOptions.${value}`),
            }))}
            onChange={(issueStatsView) => save({ issueStatsView })}
            disabled={disabled}
          />
        </AccountPreferenceRow>
        <AccountPreferenceRow label={t('activityView')} description={t('activityViewDescription')}>
          <AccountPreferenceSelect
            value={prefs.issueActivityView}
            options={ISSUE_ACTIVITY_VIEWS.map((value) => ({
              value,
              label: t(`activityViewOptions.${value}`),
            }))}
            onChange={(issueActivityView) => save({ issueActivityView })}
            disabled={disabled}
          />
        </AccountPreferenceRow>
      </AccountPreferencesSection>

      <AccountPreferencesSection
        id="notifications"
        title={t('sections.notifications')}
        description={t('sections.notificationsDescription')}
      >
        <AccountPreferenceRow label={t('autoWatch')} description={t('autoWatchDescription')}>
          <Switch
            checked={prefs.autoWatch}
            onCheckedChange={(autoWatch) => save({ autoWatch })}
            disabled={disabled}
          />
        </AccountPreferenceRow>
      </AccountPreferencesSection>

      <AccountPreferencesSection id="ai-chat" title={t('sections.aiChat')}>
        <AccountPreferenceRow
          label={t('showChatByDefault')}
          description={t('showChatByDefaultDescription')}
        >
          <Switch
            checked={prefs.showChatByDefault}
            onCheckedChange={(showChatByDefault) => save({ showChatByDefault })}
            disabled={disabled}
          />
        </AccountPreferenceRow>
      </AccountPreferencesSection>

      <AccountPreferencesSection
        id="shortcuts"
        title={t('sections.shortcuts')}
        description={t('sections.shortcutsDescription')}
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
