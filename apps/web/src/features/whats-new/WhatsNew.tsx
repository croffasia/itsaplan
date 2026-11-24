'use client';

import type { ReactNode } from 'react';
import { useMarkWhatsNewSeen, useWhatsNewQuery } from './services/whatsNew.service';
import WhatsNewOverlay from './components/WhatsNewOverlay';

// The post-upgrade screen, a startup screen: shown once per release. The query it reads
// is disabled without a session, so the sign-in screens ask for nothing.
export default function WhatsNew({ next }: { next: ReactNode }) {
  const { data, isError } = useWhatsNewQuery();
  const markSeen = useMarkWhatsNewSeen();

  if (!data) return isError ? next : null;
  if (!data.pending) return next;
  // Nothing to say: a build whose version is missing from the changelog and an
  // account that sees neither the backup nor the report.
  if (data.releases.length === 0 && !data.backup && !data.migration) return next;
  return <WhatsNewOverlay data={data} onClose={() => markSeen.mutate()} />;
}
