import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { Project } from '@/lib/api/endpoints/projects';
import { projectPath } from '@/utils/paths';
import {
  useAccountPreferencesQuery,
  useUpdateAccountPreferences,
} from '@/services/preferences.service';

// Keeps the routed project and the account in step: it redirects away from a
// project that no longer exists, moves a path that names the team by its id to the
// team's slug, and stores the open project so the index route reopens it after the
// next sign-in, on any device. `projectsLoaded` tells an empty list apart from a
// list that has not arrived yet.
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
  const pathname = usePathname();
  const prefsQuery = useAccountPreferencesQuery();
  const { mutate: saveLastProject, isPending: savingPrefs } = useUpdateAccountPreferences();

  // Redirect to a valid project if the routed one does not exist (a stale link or
  // a deleted project), preferring the first.
  useEffect(() => {
    if (!projectsLoaded) return;
    if (projectKey && projects.some((p) => p.ref === projectKey)) return;
    const byTeamId = projects.find((p) => `${p.teamId}.${p.key}` === projectKey);
    if (byTeamId) {
      const rest = pathname.split('/').slice(2).join('/');
      router.replace(`/${encodeURIComponent(byTeamId.teamRef)}/${rest}`);
      return;
    }
    const first = projects.find((project) => !project.isHidden)?.ref;
    if (first) router.replace(projectPath(first));
    else if (projects.length > 0) router.replace('/');
  }, [projectsLoaded, projects, projectKey, pathname, router]);

  // Written only when it differs from what is stored. A failed save rolls the
  // cache back, which would satisfy the condition again, so the attempted id is
  // kept and not retried.
  const savedLastProjectId = prefsQuery.data?.lastProjectId ?? null;
  const openProjectId = projects.find((p) => p.ref === projectKey)?.id ?? null;
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
