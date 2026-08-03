// Attaching an issue to a parent, and detaching it again. The change shows on both
// issues, so each mutation refreshes the detail and feed of the subtask and of the
// parents it moved between, plus the board the subtask rows are read from.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { qk } from '@/services/queryKeys';

interface SetParentVars {
  projectKey: string;
  issueId: number;
  parentId: number | null;
  // The parent the issue is leaving, so its own panel and feed refresh too.
  previousParentId?: number | null;
}

export function useSetIssueParent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: SetParentVars) => api.updateIssue(vars.issueId, { parentId: vars.parentId }),
    onSuccess: (_data, { projectKey, issueId, parentId, previousParentId }) => {
      for (const id of [issueId, parentId, previousParentId]) {
        if (id == null) continue;
        void qc.invalidateQueries({ queryKey: qk.issue(id) });
        void qc.invalidateQueries({ queryKey: qk.feed(id) });
      }
      void qc.invalidateQueries({ queryKey: qk.boardIssues(projectKey) });
    },
  });
}
