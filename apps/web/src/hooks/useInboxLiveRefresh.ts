import type { QueryKey } from '@tanstack/react-query';
import { useProjectsQuery } from '@/services/projects.service';
import { revScope } from '@/utils/revScopes';
import { useLiveRefresh } from './useLiveRefresh';

export function useInboxLiveRefresh(projectId: number | null, targets: QueryKey[], enabled = true) {
  const projects = useProjectsQuery(enabled && projectId == null);
  const scope =
    projectId == null
      ? (projects.data ?? []).map((project) => revScope.inbox(project.id))
      : revScope.inbox(projectId);
  useLiveRefresh({ scope, targets, enabled });
}
