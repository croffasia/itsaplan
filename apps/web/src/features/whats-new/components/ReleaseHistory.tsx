'use client';

import { useTranslations } from 'next-intl';
import { ExternalLink, RefreshCw } from 'lucide-react';
import type { UpdateStatus } from '@/lib/api/endpoints/updates';
import TakeoverScreen from '@/components/common/page/TakeoverScreen';
import { Button } from '@/components/ui/button';
import { useCheckForUpdates } from '@/services/updates.service';
import { formatDateTime } from '@/utils/dates';
import { cn } from '@/lib/utils';
import { releaseSections } from './ReleaseSections';

// The same screen opened from the sidebar version rather than by an upgrade: the
// whole release history, the running version marked, and the re-check the instance
// owner runs before upgrading. Closing it records nothing — only the screen shown
// after an upgrade marks a version as seen.
export default function ReleaseHistory({
  status,
  onClose,
}: {
  status: UpdateStatus;
  onClose: () => void;
}) {
  const t = useTranslations('updates');
  const tCommon = useTranslations('common');
  const check = useCheckForUpdates();

  const sections = releaseSections(status.releases, {
    empty: t('noNotes'),
    current: status.currentVersion,
    badges: { current: t('badgeRunning'), new: t('badgeNew') },
  });

  // Derived from a release link, so the repository is not hardcoded here. Only feed
  // entries carry one.
  const allReleasesUrl =
    status.releases.find((r) => r.url)?.url?.replace(/\/tag\/[^/]*$/, '') ?? null;

  return (
    <TakeoverScreen
      eyebrow={t('running', { current: status.currentVersion })}
      title={t(status.updateAvailable ? 'updateAvailable' : 'releaseHistory')}
      sections={sections}
      aside={
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => check.mutate()}
            disabled={check.isPending}
          >
            <RefreshCw className={cn('size-4', check.isPending && 'animate-spin')} />
            {t(check.isPending ? 'checking' : 'check')}
          </Button>
          {status.checkedAt && (
            <p className="text-end text-xs text-muted-foreground">
              {t('lastChecked')}
              <br />
              {formatDateTime(status.checkedAt)}
            </p>
          )}
        </div>
      }
      navFooter={
        allReleasesUrl && (
          <a
            href={allReleasesUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            {t('allReleases')}
            <ExternalLink className="size-3.5" />
          </a>
        )
      }
      actionLabel={tCommon('close')}
      onAction={onClose}
    />
  );
}
