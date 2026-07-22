import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  api,
  type BulkIssuePatch,
  type Issue,
  type IssueFieldValueInput,
  type IssuePatch,
  type NewIssueInput,
  type BoardIssues,
} from '@/lib/api';
import { qk } from '@/services/queryKeys';

export function useIssueQuery(id: number | null) {
  return useQuery({
    queryKey: qk.issue(id ?? -1),
    queryFn: () => api.getIssue(id!),
    enabled: id != null,
  });
}

// Resolves an issue by its project-scoped number (the identifier-based URL). Seeds
// the by-id cache from the result so the detail's useIssueQuery(id) is instant and
// shares one fetch. Enabled only when a number is present.
export function useIssueBySeqQuery(projectKey: string | null, seq: number | null) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: qk.issueBySeq(projectKey ?? '', seq ?? -1),
    queryFn: async () => {
      const issue = await api.getIssueBySeq(projectKey!, seq!);
      qc.setQueryData(qk.issue(issue.id), issue);
      return issue;
    },
    enabled: projectKey != null && seq != null,
  });
}

// Server-side issue search behind the command palette. Runs only when the palette
// is open and the term is non-empty; includes archived issues (the board payload
// never carries them). keepPreviousData holds the last list while the next query
// runs, so results do not blank out between keystrokes.
export function useIssueSearchQuery(
  projectKey: string | null,
  q: string,
  opts: { enabled: boolean },
) {
  const term = q.trim();
  return useQuery({
    queryKey: qk.issueSearch(projectKey ?? '', term),
    queryFn: () => api.searchIssues(projectKey!, { q: term, limit: 50 }),
    enabled: opts.enabled && projectKey != null && term.length > 0,
    placeholderData: keepPreviousData,
  });
}

// Updating an issue (drag/drop move, or an inline field edit). When `projectKey` is
// given the project detail is patched optimistically so the change shows before the
// request resolves, then reconciled on settle. Issue detail, comments and
// activity are invalidated too, since an edit produces new activity events.
export function useUpdateIssue(projectKey: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: IssuePatch }) => api.updateIssue(id, patch),
    onMutate: async ({ id, patch }) => {
      if (!projectKey) return {};
      const key = qk.boardIssues(projectKey);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<BoardIssues>(key);
      if (prev) {
        qc.setQueryData<BoardIssues>(key, {
          ...prev,
          issues: prev.issues.map((t) => (t.id === id ? ({ ...t, ...patch } as Issue) : t)),
        });
      }
      return { prev, key };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev && ctx.key) qc.setQueryData(ctx.key, ctx.prev);
    },
    onSettled: (_data, _err, { id }) => {
      if (projectKey) void qc.invalidateQueries({ queryKey: qk.boardIssues(projectKey) });
      void qc.invalidateQueries({ queryKey: qk.issue(id) });
      void qc.invalidateQueries({ queryKey: qk.feed(id) });
      invalidateInitiatives(qc);
    },
  });
}

// An issue write changes its initiative's progress/health and activity, and the
// initiatives list shows that progress. The mutations do not know the initiative
// id, so they invalidate by prefix; only active queries refetch.
function invalidateInitiatives(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: qk.anyInitiative });
  void qc.invalidateQueries({ queryKey: qk.anyInitiativeFeed });
  void qc.invalidateQueries({ queryKey: qk.anyInitiatives });
}

// Deletes an issue. Drops it from the project detail immediately and discards its
// per-issue caches, then refetches the project to reconcile.
export function useDeleteIssue(projectKey: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteIssue(id),
    onSuccess: async (_data, id) => {
      if (projectKey) {
        // Cancel any project fetch already in flight before removing the issue
        // from the cache. Such a fetch was issued before the delete (e.g. an
        // earlier edit's onSettled refetch) and still lists the deleted issue;
        // if it resolved after this removal it would re-add the issue until the
        // next refetch. Cancelling discards it so the optimistic removal sticks.
        await qc.cancelQueries({ queryKey: qk.boardIssues(projectKey) });
        qc.setQueryData<BoardIssues>(qk.boardIssues(projectKey), (prev) =>
          prev ? { ...prev, issues: prev.issues.filter((t) => t.id !== id) } : prev,
        );
        void qc.invalidateQueries({ queryKey: qk.boardIssues(projectKey) });
      }
      qc.removeQueries({ queryKey: qk.issue(id) });
      qc.removeQueries({ queryKey: qk.feed(id) });
      qc.removeQueries({ queryKey: qk.attachments(id) });
      invalidateInitiatives(qc);
    },
  });
}

// Archives an issue. Like delete, it leaves the board immediately (dropped from the
// project detail), but the row is kept: the archived-issues list and the issue's own
// caches are invalidated so a reopened detail shows the archived state.
export function useArchiveIssue(projectKey: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.archiveIssue(id),
    onSuccess: async (_data, id) => {
      if (projectKey) {
        await qc.cancelQueries({ queryKey: qk.boardIssues(projectKey) });
        qc.setQueryData<BoardIssues>(qk.boardIssues(projectKey), (prev) =>
          prev ? { ...prev, issues: prev.issues.filter((t) => t.id !== id) } : prev,
        );
        void qc.invalidateQueries({ queryKey: qk.boardIssues(projectKey) });
        void qc.invalidateQueries({ queryKey: qk.archivedIssues(projectKey) });
      }
      void qc.invalidateQueries({ queryKey: qk.issue(id) });
      void qc.invalidateQueries({ queryKey: qk.feed(id) });
      invalidateInitiatives(qc);
    },
  });
}

// Restores an archived issue back onto the board. Invalidates the board (it
// reappears), the archived list (it leaves), and the issue's caches.
export function useRestoreIssue(projectKey: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.restoreIssue(id),
    onSuccess: (_data, id) => {
      if (projectKey) {
        void qc.invalidateQueries({ queryKey: qk.boardIssues(projectKey) });
        void qc.invalidateQueries({ queryKey: qk.archivedIssues(projectKey) });
      }
      void qc.invalidateQueries({ queryKey: qk.issue(id) });
      void qc.invalidateQueries({ queryKey: qk.feed(id) });
      invalidateInitiatives(qc);
    },
  });
}

// Setting a custom field value. Invalidates the issue (the value lives on it),
// its activity feed, and — since the project's issues carry field values for
// filtering — the project detail.
export function useSetFieldValue(projectKey: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      issueId,
      fieldId,
      value,
    }: {
      issueId: number;
      fieldId: number;
      value: IssueFieldValueInput;
    }) => api.setFieldValue(issueId, fieldId, value),
    onSettled: (_data, _err, { issueId }) => {
      void qc.invalidateQueries({ queryKey: qk.issue(issueId) });
      void qc.invalidateQueries({ queryKey: qk.feed(issueId) });
      if (projectKey) void qc.invalidateQueries({ queryKey: qk.boardIssues(projectKey) });
    },
  });
}

// --- Bulk actions (board multi-select) -------------------------------------------
// One request changes many issues. Each optimistically patches the project cache
// the same way its single-issue counterpart does, then invalidates the board and
// initiatives on settle. The project detail is patched by id set so the board
// reflects the change before the request resolves.

export function useBulkUpdateIssues(projectKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, patch }: { ids: number[]; patch: BulkIssuePatch }) =>
      api.bulkUpdateIssues(projectKey, ids, patch),
    onMutate: async ({ ids, patch }) => {
      const key = qk.boardIssues(projectKey);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<BoardIssues>(key);
      if (prev) {
        const idSet = new Set(ids);
        qc.setQueryData<BoardIssues>(key, {
          ...prev,
          issues: prev.issues.map((t) => (idSet.has(t.id) ? ({ ...t, ...patch } as Issue) : t)),
        });
      }
      return { prev, key };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev && ctx.key) qc.setQueryData(ctx.key, ctx.prev);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.boardIssues(projectKey) });
      invalidateInitiatives(qc);
    },
  });
}

export function useBulkAddLabels(projectKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, add }: { ids: number[]; add: number[] }) =>
      api.bulkAddLabels(projectKey, ids, add),
    onMutate: async ({ ids, add }) => {
      const key = qk.boardIssues(projectKey);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<BoardIssues>(key);
      if (prev) {
        const idSet = new Set(ids);
        qc.setQueryData<BoardIssues>(key, {
          ...prev,
          issues: prev.issues.map((t) =>
            idSet.has(t.id) ? { ...t, labelIds: [...new Set([...t.labelIds, ...add])] } : t,
          ),
        });
      }
      return { prev, key };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev && ctx.key) qc.setQueryData(ctx.key, ctx.prev);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.boardIssues(projectKey) });
      invalidateInitiatives(qc);
    },
  });
}

// Archive and delete both drop the issues from the board immediately, then
// reconcile. A project fetch already in flight is cancelled first so it cannot
// re-add the removed issues (see the single-issue delete for the same reasoning).
function useBulkRemoval(projectKey: string, run: (ids: number[]) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: number[]) => run(ids),
    onSuccess: async (_data, ids) => {
      const idSet = new Set(ids);
      await qc.cancelQueries({ queryKey: qk.boardIssues(projectKey) });
      qc.setQueryData<BoardIssues>(qk.boardIssues(projectKey), (prev) =>
        prev ? { ...prev, issues: prev.issues.filter((t) => !idSet.has(t.id)) } : prev,
      );
      void qc.invalidateQueries({ queryKey: qk.boardIssues(projectKey) });
      void qc.invalidateQueries({ queryKey: qk.archivedIssues(projectKey) });
      for (const id of ids) {
        qc.removeQueries({ queryKey: qk.issue(id) });
        qc.removeQueries({ queryKey: qk.feed(id) });
      }
      invalidateInitiatives(qc);
    },
  });
}

export function useBulkArchiveIssues(projectKey: string) {
  return useBulkRemoval(projectKey, (ids) => api.bulkArchiveIssues(projectKey, ids));
}

export function useBulkDeleteIssues(projectKey: string) {
  return useBulkRemoval(projectKey, (ids) => api.bulkDeleteIssues(projectKey, ids));
}

export function useCreateIssue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectKey, input }: { projectKey: string; input: NewIssueInput }) =>
      api.createIssue(projectKey, input),
    onSuccess: (_data, { projectKey }) => {
      void qc.invalidateQueries({ queryKey: qk.boardIssues(projectKey) });
      invalidateInitiatives(qc);
    },
  });
}
