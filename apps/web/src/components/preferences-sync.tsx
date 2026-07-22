'use client';

import { useEffect } from 'react';
import { useTheme } from 'next-themes';
import {
  useAccountPreferencesQuery,
  useUpdateAccountPreferences,
} from '@/services/preferences.service';
import { canonicalTimezone, setDisplayTimezone } from '@/utils/dates';

// Applies the account preferences that are read app-wide rather than at one call
// site: the theme (handed to next-themes) and the display timezone (handed to the
// date formatters). Renders nothing.
//
// The timezone starts as 'UTC' for an account that never set one, which is rarely
// what the person means, so the first load detects the browser zone and saves it.
// From then on the stored value wins, including when they pick UTC on purpose.
export default function PreferencesSync() {
  const { data: prefs } = useAccountPreferencesQuery();
  const { setTheme } = useTheme();
  const update = useUpdateAccountPreferences();

  const timezone = prefs?.timezone;
  const theme = prefs?.theme;

  useEffect(() => {
    if (timezone) setDisplayTimezone(timezone);
  }, [timezone]);

  useEffect(() => {
    if (theme) setTheme(theme);
  }, [theme, setTheme]);

  useEffect(() => {
    if (timezone !== 'UTC') return;
    const detected = canonicalTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    if (!detected || detected === 'UTC') return;
    update.mutate({ timezone: detected });
    // The mutation identity changes on every render, so it stays out of the deps:
    // this runs once per load while the stored zone is still the untouched default.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timezone]);

  return null;
}
