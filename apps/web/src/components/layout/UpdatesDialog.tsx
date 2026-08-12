'use client';

import { useState } from 'react';
import { ChevronRight, ExternalLink, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { UpdateStatus } from '@/lib/api';
import Modal from '@/components/common/overlay/Modal';
import ReleaseNotes from '@/components/layout/ReleaseNotes';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useCheckForUpdates } from '@/services/updates.service';
import { formatDateTime } from '@/utils/dates';
import { isNewerVersion } from '@/utils/version';
import { cn } from '@/lib/utils';

// The release notes behind the sidebar version. With a newer release published,
// the ones above the running version are expanded and the history sits behind a
// toggle; otherwise it is the history alone, with the running version marked.
export default function UpdatesDialog({
  status,
  onClose,
}: {
  status: UpdateStatus;
  onClose: () => void;
}) {
  const t = useTranslations('updates');
  const check = useCheckForUpdates();
  const [showEarlier, setShowEarlier] = useState(false);

  // Without a successful check, calling the running version the latest would claim
  // more than is known.
  const summary = status.updateAvailable
    ? t('runningOutdated', { current: status.currentVersion, latest: status.latestVersion ?? '' })
    : status.latestVersion
      ? t('runningLatest', { current: status.currentVersion })
      : t('runningUnknown', { current: status.currentVersion });

  const newer = status.releases.filter((r) => isNewerVersion(r.version, status.currentVersion));
  const earlier = status.releases.filter((r) => !isNewerVersion(r.version, status.currentVersion));
  // Derived from a release link, so the repository is not hardcoded here. Only feed
  // entries carry one.
  const tagUrl = status.releases.find((r) => r.url)?.url;
  const allReleasesUrl = tagUrl?.replace(/\/tag\/[^/]*$/, '') ?? null;

  const earlierList = earlier.map((release) => (
    <ReleaseNotes
      key={release.tag}
      release={release}
      badge={release.version === status.currentVersion ? t('badgeRunning') : undefined}
    />
  ));

  return (
    <Modal
      title={t(status.updateAvailable ? 'updateAvailable' : 'releaseHistory')}
      description={summary}
      onClose={onClose}
      wide
    >
      <div className="space-y-4">
        {status.releases.length === 0 && (
          <p className="text-sm text-muted-foreground">{t('noReleases')}</p>
        )}

        {newer.map((release) => (
          <ReleaseNotes key={release.tag} release={release} badge={t('badgeNew')} />
        ))}

        {newer.length > 0 && earlier.length > 0 ? (
          <Collapsible open={showEarlier} onOpenChange={setShowEarlier}>
            <CollapsibleTrigger className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ChevronRight
                className={cn('size-4 transition-transform', showEarlier && 'rotate-90')}
              />
              {t('earlier')}
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4 space-y-4">{earlierList}</CollapsibleContent>
          </Collapsible>
        ) : (
          earlierList
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
        <div className="flex items-center gap-3">
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
            <span className="text-xs text-muted-foreground">
              {t('lastChecked', { date: formatDateTime(status.checkedAt) })}
            </span>
          )}
        </div>
        {allReleasesUrl && (
          <a
            href={allReleasesUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            {t('allReleases')}
            <ExternalLink className="size-3.5" />
          </a>
        )}
      </div>
    </Modal>
  );
}
