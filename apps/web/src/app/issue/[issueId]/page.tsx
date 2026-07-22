'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useIssueQuery } from '@/services/issues.service';
import { issuePath } from '@/utils/paths';

// A bare deep link /issue/:issueId has no project key in the URL. Resolve the
// issue's project (its identifier is "<projectKey>-<number>") and redirect to the
// project-scoped issue route so it opens inside the Shell layout.
export default function IssueRedirect() {
  const router = useRouter();
  const params = useParams();
  const id = Number(typeof params.issueId === 'string' ? params.issueId : NaN);
  const { data, isLoading } = useIssueQuery(Number.isNaN(id) ? null : id);

  useEffect(() => {
    if (isLoading) return;
    const projectKey = data ? data.identifier.replace(/-\d+$/, '') : null;
    router.replace(projectKey && data ? issuePath(projectKey, data.sequenceNumber) : '/');
  }, [data, isLoading, router]);

  return (
    <div className="flex h-svh items-center justify-center bg-background text-sm text-muted-foreground">
      Loading…
    </div>
  );
}
