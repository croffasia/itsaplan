// Relations between issues. A relation is written on one issue and shows on both,
// so each mutation refreshes the issue detail and feed of both ends.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type IssueLinkInputKind } from '@/lib/api';
import { qk } from '@/services/queryKeys';

interface LinkVars {
  projectKey: string;
  issueId: number;
  otherIssueId: number;
}

function useLinkMutation<TVars extends LinkVars>(run: (vars: TVars) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: (_data, { projectKey, issueId, otherIssueId }) => {
      for (const id of [issueId, otherIssueId]) {
        void qc.invalidateQueries({ queryKey: qk.issue(id) });
        void qc.invalidateQueries({ queryKey: qk.feed(id) });
      }
      // The relations come with the board issues, which the work-items views read
      // them from.
      void qc.invalidateQueries({ queryKey: qk.boardIssues(projectKey) });
    },
  });
}

export function useLinkIssues() {
  return useLinkMutation((vars: LinkVars & { kind: IssueLinkInputKind }) =>
    api.linkIssues(vars.issueId, vars.otherIssueId, vars.kind),
  );
}

export function useUnlinkIssues() {
  return useLinkMutation((vars: LinkVars & { linkId: number }) =>
    api.unlinkIssues(vars.issueId, vars.linkId),
  );
}
