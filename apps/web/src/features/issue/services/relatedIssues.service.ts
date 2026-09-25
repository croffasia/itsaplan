// Changing the state of an issue listed on another issue's page: a subtask, the
// parent, a linked issue. The list is read from the viewed issue's detail, so that
// detail and its feed refresh too, besides what useUpdateIssue refreshes for the
// changed issue.

import { useQueryClient } from '@tanstack/react-query';
import { useUpdateIssue } from '@/services/issues.service';
import { qk } from '@/services/queryKeys';

export function useSetRelatedIssueState(projectKey: string, viewedIssueId: number) {
  const qc = useQueryClient();
  const updateIssue = useUpdateIssue(projectKey);
  return (issueId: number, columnId: number) =>
    updateIssue.mutate(
      { id: issueId, patch: { columnId } },
      {
        onSettled: () => {
          void qc.invalidateQueries({ queryKey: qk.issue(viewedIssueId) });
          void qc.invalidateQueries({ queryKey: qk.feed(viewedIssueId) });
        },
      },
    );
}
