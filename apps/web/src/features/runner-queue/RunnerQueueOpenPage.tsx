'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useShell } from '@/context/shellContext';
import { useShellRoute } from '@/hooks/useShellRoute';
import { projectPath } from '@/utils/paths';

// The address of a project's runs, or of one of them: it opens the side panel there over
// the project's work items.
export default function RunnerQueueOpenPage({ runId }: { runId: number | null }) {
  const router = useRouter();
  const { projectKey } = useShellRoute();
  const { onOpenRuns } = useShell();

  useEffect(() => {
    if (!projectKey) return;
    onOpenRuns(runId);
    router.replace(projectPath(projectKey));
    // Once per address: the callback changes with every Shell render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectKey, runId]);

  return null;
}
