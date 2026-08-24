// The time logged on an issue. The entries are their own read; their sum comes with
// the issue and every write is in the activity feed, so a mutation refreshes all
// three. The board carries the sum too, which is why the project's issues follow.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type WorklogInput } from '@/lib/api';
import { qk } from '@/services/queryKeys';

export function useWorklogsQuery(issueId: number) {
  return useQuery({ queryKey: qk.worklogs(issueId), queryFn: () => api.listWorklogs(issueId) });
}

function useWorklogMutation<TVars extends { issueId: number; projectKey: string }>(
  run: (vars: TVars) => Promise<unknown>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: (_data, { issueId, projectKey }) => {
      void qc.invalidateQueries({ queryKey: qk.worklogs(issueId) });
      void qc.invalidateQueries({ queryKey: qk.issue(issueId) });
      void qc.invalidateQueries({ queryKey: qk.feed(issueId) });
      void qc.invalidateQueries({ queryKey: qk.boardIssues(projectKey) });
    },
  });
}

export function useCreateWorklog() {
  return useWorklogMutation((vars: { issueId: number; projectKey: string; input: WorklogInput }) =>
    api.createWorklog(vars.issueId, vars.input),
  );
}

export function useUpdateWorklog() {
  return useWorklogMutation(
    (vars: {
      issueId: number;
      projectKey: string;
      worklogId: number;
      patch: Partial<WorklogInput>;
    }) => api.updateWorklog(vars.worklogId, vars.patch),
  );
}

export function useDeleteWorklog() {
  return useWorklogMutation((vars: { issueId: number; projectKey: string; worklogId: number }) =>
    api.deleteWorklog(vars.worklogId),
  );
}
