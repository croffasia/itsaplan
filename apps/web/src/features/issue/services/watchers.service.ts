// Following an issue, for the signed-in user only. The response carries the
// resulting watcher list, so the cached issue takes it directly instead of being
// refetched.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type IssueWithWatchers } from '@/lib/api';
import { qk } from '@/services/queryKeys';

export const watcherMutationKey = (issueId: number) => ['issue-watchers', issueId] as const;

function updateWatchers(
  qc: ReturnType<typeof useQueryClient>,
  issueId: number,
  watchers: IssueWithWatchers['watchers'],
) {
  qc.setQueryData<IssueWithWatchers>(qk.issue(issueId), (prev) =>
    prev ? { ...prev, watchers } : prev,
  );
}

// All watcher writes for one issue share a TanStack mutation scope. That makes
// self-service and editor changes run serially even if the responsive detail has
// two mounted property panes while crossing a breakpoint.
export function useSetIssueWatching(issueId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: watcherMutationKey(issueId),
    mutationFn: ({ watching }: { watching: boolean }) =>
      watching ? api.watchIssue(issueId) : api.unwatchIssue(issueId),
    scope: { id: `issue-watchers-${issueId}` },
    onSuccess: (watchers) => updateWatchers(qc, issueId, watchers),
    onSettled: () => void qc.invalidateQueries({ queryKey: qk.issue(issueId) }),
  });
}

export function useSetIssueWatcher(issueId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: watcherMutationKey(issueId),
    mutationFn: ({ userId, watching }: { userId: string; watching: boolean }) =>
      watching ? api.addIssueWatcher(issueId, userId) : api.removeIssueWatcher(issueId, userId),
    scope: { id: `issue-watchers-${issueId}` },
    onSuccess: (watchers) => updateWatchers(qc, issueId, watchers),
    onSettled: () => void qc.invalidateQueries({ queryKey: qk.issue(issueId) }),
  });
}
