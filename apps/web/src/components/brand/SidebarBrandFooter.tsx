'use client';

import { useEffect, useState } from 'react';
import ItsAPlanMark from '@/components/brand/ItsAPlanMark';
import UpdatesDialog from '@/components/layout/UpdatesDialog';
import { useSession } from '@/lib/auth-client';
import { cn } from '@/lib/utils';
import { useAppVersionQuery, useUpdateStatusQuery } from '@/services/updates.service';

// The product mark at the bottom of both sidebars, with the running version under
// it. Collapses to the mark alone when the sidebar is in icon mode.
//
// The instance owner also sees whether a newer release is published and opens the
// release notes from here — they are the one who upgrades the instance, so the
// check is theirs alone (GET /god/updates). Everyone else sees the version only.
export default function SidebarBrandFooter() {
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

  const content = (
    <>
      <ItsAPlanMark className="size-9 shrink-0 text-sidebar-foreground" />
      <div className="grid text-left leading-none group-data-[collapsible=icon]:hidden">
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
    </>
  );

  // Without the owner's release data there is nothing to open, so the footer stays
  // the plain mark it is for everyone else.
  if (!status) return <div className={layout}>{content}</div>;

  return (
    <>
      <button
        type="button"
        className={cn(layout, 'rounded-md hover:bg-sidebar-accent')}
        onClick={() => setShowUpdates(true)}
      >
        {content}
      </button>
      {showUpdates && <UpdatesDialog status={status} onClose={() => setShowUpdates(false)} />}
    </>
  );
}
