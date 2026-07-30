'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useShell } from '@/context/shellContext';
import type { InitiativeCounts } from '@/lib/api';
import { useInitiativeCountsQuery } from '@/services/initiatives.service';
import { initiativesTabPath, type InitiativesTab } from '@/utils/paths';
import { readInitiativeTabOrder } from './hooks/useInitiativeTabOrder';
import { tabCount } from './utils/tabs';

// Without counts there is nothing to choose by, so "All" it is: a project with no
// initiatives lands there too, and its empty state offers to create one.
function firstTabWithInitiatives(counts: InitiativeCounts | undefined): InitiativesTab {
  if (!counts) return 'all';
  return readInitiativeTabOrder().find((t) => (tabCount(counts, t) ?? 0) > 0) ?? 'all';
}

// What the initiatives list path opens: the first tab that holds initiatives, in
// the order the person arranged the strip in. The replace keeps the path out of the
// history, so Back leaves the section instead of redirecting again.
//
// This has to run on the client: the order is in localStorage, which the server
// render cannot read. Until the counts arrive the page renders nothing; a failed
// counts request still redirects, otherwise the path would stay blank.
export default function InitiativesRedirect() {
  const { project } = useShell();
  const router = useRouter();
  const projectKey = project?.project.key ?? null;
  const { data: counts, isError } = useInitiativeCountsQuery(projectKey);

  useEffect(() => {
    if (!projectKey || (!counts && !isError)) return;
    router.replace(initiativesTabPath(projectKey, firstTabWithInitiatives(counts)));
  }, [projectKey, counts, isError, router]);

  return null;
}
