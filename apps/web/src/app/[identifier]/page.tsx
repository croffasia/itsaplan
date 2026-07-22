'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

// Short link for an issue by its identifier, e.g. /IAP-62. The identifier is
// "<projectKey>-<number>", so it maps straight to the canonical project-scoped URL
// without a lookup. A segment that is not an identifier falls back to the home page.
// Static top-level routes (login, project, ...) take precedence over this dynamic
// segment, so only otherwise-unmatched paths reach here.
export default function IssueShortLink() {
  const router = useRouter();
  const params = useParams();
  const identifier = typeof params.identifier === 'string' ? params.identifier : '';

  useEffect(() => {
    const match = /^(.+)-(\d+)$/.exec(identifier);
    router.replace(match ? `/project/${match[1]}/issue/${match[2]}` : '/');
  }, [identifier, router]);

  return (
    <div className="flex h-svh items-center justify-center bg-background text-sm text-muted-foreground">
      Loading…
    </div>
  );
}
