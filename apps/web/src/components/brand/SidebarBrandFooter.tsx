'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { BrandMark } from '@/cloud';
import { useOnboardingTour } from '@/context/onboardingTour';
import ReleaseHistory from '@/features/whats-new/components/ReleaseHistory';
import { useSession } from '@/lib/auth-client';
import { useAppVersionQuery, useUpdateStatusQuery } from '@/services/updates.service';

// The product mark at the bottom of both sidebars, with the running version under
// it. Collapses to the mark alone when the sidebar is in icon mode. The mark opens the
// tour of the product.
//
// The instance owner also sees whether a newer release is published and opens the
// release notes from the name and version — they are the one who upgrades the
// instance, so the check is theirs alone (GET /god/updates). Everyone else sees the
// version only.
export default function SidebarBrandFooter() {
  const t = useTranslations('onboarding');
  const tour = useOnboardingTour();
  const { data: session } = useSession();
  // The session store can already be filled by the time React hydrates, while the
  // server rendered without it. Reading it only after mount keeps the server and
  // the first client render identical.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isGod = mounted && session?.user.role === 'god';

  const { data: appVersion } = useAppVersionQuery();
  const { data: status } = useUpdateStatusQuery(isGod);
  const [showUpdates, setShowUpdates] = useState(false);

  const version = appVersion?.version ?? status?.currentVersion;
  // The version to offer, or null when the running one is the newest known.
  const newerVersion = status?.updateAvailable ? status.latestVersion : null;

  const layout =
    'flex w-full items-center gap-2.5 px-2 pt-2 pb-1.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0';

  const mark = (
    <button
      type="button"
      onClick={tour.replay}
      aria-label={t('replay')}
      title={t('replay')}
      className="shrink-0 rounded-md transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-hidden"
    >
      <BrandMark className="size-9 text-sidebar-foreground" />
    </button>
  );

  const content = (
    <div className="grid text-start leading-none group-data-[collapsible=icon]:hidden">
      <span className="text-base font-semibold tracking-tight text-sidebar-foreground">
        It&apos;s a Plan
      </span>
      {newerVersion ? (
        <span className="mt-1 flex items-center gap-1.5 text-[10px] font-medium tracking-wider text-primary uppercase">
          {/* A pulsing ring around the dot, so the update is noticed in a footer
                nobody looks at. */}
          <span className="relative flex size-1.5" aria-hidden>
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" />
            <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
          </span>
          {`v${newerVersion} available`}
        </span>
      ) : (
        <span className="mt-1 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
          {version ? `v${version}` : 'Self-hosted'}
        </span>
      )}
    </div>
  );

  // Without the owner's release data there is nothing to open, so the name and version
  // stay plain text for everyone else.
  if (!status) {
    return (
      <div className={layout}>
        {mark}
        {content}
      </div>
    );
  }

  return (
    <>
      <div className={layout}>
        {mark}
        <button
          type="button"
          className="min-w-0 flex-1 rounded-md group-data-[collapsible=icon]:hidden focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-hidden"
          onClick={() => setShowUpdates(true)}
        >
          {content}
        </button>
      </div>
      {showUpdates && <ReleaseHistory status={status} onClose={() => setShowUpdates(false)} />}
    </>
  );
}
