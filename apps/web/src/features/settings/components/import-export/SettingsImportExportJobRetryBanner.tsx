import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import SettingsWarningBanner from '../SettingsWarningBanner';

// A job waiting out a retry, with the seconds left until the next attempt.
export default function SettingsImportExportJobRetryBanner({
  error,
  nextAttemptAt,
}: {
  error: string;
  nextAttemptAt: string;
}) {
  const t = useTranslations('settings.importExport');

  // The 2s poll (useImportJobsQuery) only refreshes nextAttemptAt itself; without
  // this, the displayed countdown would only move in those 2s jumps instead of
  // ticking down in real time between polls.
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const seconds = Math.max(0, Math.round((new Date(nextAttemptAt).getTime() - Date.now()) / 1000));

  return (
    <SettingsWarningBanner>
      {error === 'rate limited'
        ? t('rateLimitedRetrying', { seconds })
        : t('transientErrorRetrying', { error, seconds })}
    </SettingsWarningBanner>
  );
}
