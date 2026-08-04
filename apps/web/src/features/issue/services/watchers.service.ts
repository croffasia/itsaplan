// Following an issue, for the signed-in user only. The response carries the
// resulting watcher list, so the cached issue takes it directly instead of being
// refetched.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type IssueWithWatchers } from '@/lib/api';
import { qk } from '@/services/queryKeys';

export function useSetIssueWatching() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ issueId, watching }: { issueId: number; watching: boolean }) =>
      watching ? api.watchIssue(issueId) : api.unwatchIssue(issueId),
    onSuccess: (watchers, { issueId }) => {
      qc.setQueryData<IssueWithWatchers>(qk.issue(issueId), (prev) =>
        prev ? { ...prev, watchers } : prev,
      );
    },
  });
}
