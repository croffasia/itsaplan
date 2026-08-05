'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useShell } from '@/context/shellContext';
import { cyclesViewPath } from '@/utils/paths';
import { readCyclesView } from './utils/cyclesView';

// What the cycles list path opens: the layout last used in this project. The
// replace keeps the path out of the history, so Back leaves the section instead of
// redirecting again.
//
// This has to run on the client: the remembered layout is in localStorage, which
// the server render cannot read.
export default function CyclesRedirect() {
  const { project } = useShell();
  const router = useRouter();
  const projectKey = project?.project.key ?? null;

  useEffect(() => {
    if (!projectKey) return;
    router.replace(cyclesViewPath(projectKey, readCyclesView(projectKey)));
  }, [projectKey, router]);

  return null;
}
