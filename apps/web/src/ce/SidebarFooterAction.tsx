'use client';

import { useEffect, useState } from 'react';
import UpgradeToProButton from '@/components/common/UpgradeToProButton';
import { useSession } from '@/lib/auth-client';

// Above the product mark at the bottom of the app sidebar. A self-hosted instance links
// its owner to Pro; the hosted build renders its own content or nothing.
export default function SidebarFooterAction() {
  const { data: session } = useSession();
  // The session is read after mount, so the first client render matches the server's.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || session?.user.role !== 'god') return null;

  return <UpgradeToProButton className="w-full group-data-[collapsible=icon]:hidden" />;
}
