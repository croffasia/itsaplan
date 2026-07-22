import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { Project } from '@/lib/api';
import { projectPath } from '@/utils/paths';
import {
  useAccountPreferencesQuery,
  useUpdateAccountPreferences,
} from '@/services/preferences.service';

// Keeps the routed project and the account in step: it redirects away from a
// project key that no longer exists, and stores the open project so the index
// route reopens it after the next sign-in, on any device. `projectsLoaded` tells
// an empty list apart from a list that has not arrived yet.
export function useProjectRouteSync({
  projects,
  projectsLoaded,
  projectKey,
}: {
  projects: Project[];
  projectsLoaded: boolean;
  projectKey: string | null;
}) {
  const router = useRouter();
  const prefsQuery = useAccountPreferencesQuery();
  const { mutate: saveLastProject, isPending: savingPrefs } = useUpdateAccountPreferences();

  // Redirect to a valid project if the routed key does not exist (a stale link or
  // a deleted project), preferring the first.
  useEffect(() => {
    if (!projectsLoaded) return;
    if (projectKey && projects.some((p) => p.key === projectKey)) return;
    const first = projects[0]?.key;
    if (first) router.replace(projectPath(first));
  }, [projectsLoaded, projects, projectKey, router]);

  // Written only when it differs from what is stored. A failed save rolls the
  // cache back, which would satisfy the condition again, so the attempted id is
  // kept and not retried.
  const savedLastProjectId = prefsQuery.data?.lastProjectId ?? null;
  const openProjectId = projects.find((p) => p.key === projectKey)?.id ?? null;
  const failedLastProjectId = useRef<number | null>(null);
  useEffect(() => {
    if (prefsQuery.data == null || openProjectId == null) return;
    if (openProjectId === savedLastProjectId || savingPrefs) return;
    if (openProjectId === failedLastProjectId.current) return;
    saveLastProject(
      { lastProjectId: openProjectId },
      { onError: () => (failedLastProjectId.current = openProjectId) },
    );
  }, [prefsQuery.data, openProjectId, savedLastProjectId, savingPrefs, saveLastProject]);
}
