import type { QueryKey } from '@tanstack/react-query';
import { revScope } from '@/utils/revScopes';
import { useLiveRefresh } from './useLiveRefresh';

export function useInboxLiveRefresh(projectId: number | null, targets: QueryKey[], enabled = true) {
  const scope = projectId == null ? revScope.inboxAll : revScope.inbox(projectId);
  useLiveRefresh({ scope, targets, enabled });
}
