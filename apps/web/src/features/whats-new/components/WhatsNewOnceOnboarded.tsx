'use client';

import { usePathname } from 'next/navigation';
import { useProjectsQuery } from '@/services/projects.service';
import type { WhatsNew } from '@/lib/api/endpoints/updates';
import { useMarkWhatsNewSeen } from '../services/whatsNew.service';
import WhatsNewOverlay from './WhatsNewOverlay';

// Waits until the account has a project, so the screen does not cover the first team
// and project being created or an invite being accepted.
export default function WhatsNewOnceOnboarded({ data }: { data: WhatsNew }) {
  const pathname = usePathname();
  const { data: projects } = useProjectsQuery();
  const markSeen = useMarkWhatsNewSeen();

  if (pathname.startsWith('/invite') || !projects?.length) return null;
  return <WhatsNewOverlay data={data} onClose={() => markSeen.mutate()} />;
}
