// Checklists on an issue. They come with the issue detail read, so every mutation
// refreshes that query rather than one of its own. Checking a box and dragging a
// row write to the cache first: both are direct manipulations of something already
// on screen, and waiting for the round trip would make them feel broken.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type Checklist, type IssueWithWatchers } from '@/lib/api';
import { qk } from '@/services/queryKeys';

// Puts a list in the order given by ids. Ids that are not in the list are skipped,
// and anything the caller left out keeps its place at the end — the same rule the
// API applies, so the optimistic order matches what comes back.
function applyOrder<T extends { id: number }>(rows: T[], orderedIds: number[]): T[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const ordered = orderedIds.map((id) => byId.get(id)).filter((row): row is T => !!row);
  const moved = new Set(ordered.map((row) => row.id));
  return [...ordered, ...rows.filter((row) => !moved.has(row.id))];
}

// The write-then-refresh mutations: the server owns the result, so the cache is
// only invalidated. The feed is refreshed too, since these are the changes that
// are logged to it.
function useChecklistMutation<TVars extends { issueId: number }>(
  run: (vars: TVars) => Promise<unknown>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: (_data, { issueId }) => {
      void qc.invalidateQueries({ queryKey: qk.issue(issueId) });
      void qc.invalidateQueries({ queryKey: qk.feed(issueId) });
    },
  });
}

// The mutations that show their result before the server confirms it: the change
// is written into the cached issue, rolled back if the request fails, and settled
// by a refetch either way. None of them are logged to the feed, so only the issue
// is invalidated.
function useOptimisticChecklistMutation<TVars extends { issueId: number }>(
  run: (vars: TVars) => Promise<unknown>,
  change: (checklists: Checklist[], vars: TVars) => Checklist[],
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: run,
    onMutate: async (vars: TVars) => {
      const key = qk.issue(vars.issueId);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<IssueWithWatchers>(key);
      if (previous) {
        qc.setQueryData<IssueWithWatchers>(key, {
          ...previous,
          checklists: change(previous.checklists, vars),
        });
      }
      return { previous };
    },
    onError: (_err, { issueId }, context) => {
      if (context?.previous) qc.setQueryData(qk.issue(issueId), context.previous);
    },
    onSettled: (_data, _err, { issueId }) => {
      void qc.invalidateQueries({ queryKey: qk.issue(issueId) });
    },
  });
}

export function useCreateChecklist() {
  return useChecklistMutation((vars: { issueId: number; title: string }) =>
    api.createChecklist(vars.issueId, vars.title),
  );
}

export function useRenameChecklist() {
  return useChecklistMutation((vars: { issueId: number; checklistId: number; title: string }) =>
    api.renameChecklist(vars.checklistId, vars.title),
  );
}

export function useDeleteChecklist() {
  return useChecklistMutation((vars: { issueId: number; checklistId: number }) =>
    api.deleteChecklist(vars.checklistId),
  );
}

export function useCreateChecklistItem() {
  return useChecklistMutation((vars: { issueId: number; checklistId: number; content: string }) =>
    api.createChecklistItem(vars.checklistId, vars.content),
  );
}

export function useDeleteChecklistItem() {
  return useChecklistMutation((vars: { issueId: number; itemId: number }) =>
    api.deleteChecklistItem(vars.itemId),
  );
}

export function useUpdateChecklistItem() {
  return useOptimisticChecklistMutation(
    (vars: {
      issueId: number;
      checklistId: number;
      itemId: number;
      patch: { content?: string; done?: boolean };
    }) => api.updateChecklistItem(vars.itemId, vars.patch),
    (checklists, { checklistId, itemId, patch }) =>
      checklists.map((checklist) =>
        checklist.id === checklistId
          ? {
              ...checklist,
              items: checklist.items.map((item) =>
                item.id === itemId ? { ...item, ...patch } : item,
              ),
            }
          : checklist,
      ),
  );
}

export function useReorderChecklists() {
  return useOptimisticChecklistMutation(
    (vars: { issueId: number; orderedIds: number[] }) =>
      api.reorderChecklists(vars.issueId, vars.orderedIds),
    (checklists, { orderedIds }) => applyOrder(checklists, orderedIds),
  );
}

export function useReorderChecklistItems() {
  return useOptimisticChecklistMutation(
    (vars: { issueId: number; checklistId: number; orderedIds: number[] }) =>
      api.reorderChecklistItems(vars.checklistId, vars.orderedIds),
    (checklists, { checklistId, orderedIds }) =>
      checklists.map((checklist) =>
        checklist.id === checklistId
          ? { ...checklist, items: applyOrder(checklist.items, orderedIds) }
          : checklist,
      ),
  );
}
