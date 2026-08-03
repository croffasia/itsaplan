import { type BulkIssuePatch, type ProjectDetail, type SubtaskDisposition } from '@/lib/api';
import {
  useBulkAddLabels,
  useBulkArchiveIssues,
  useBulkDeleteIssues,
  useBulkUpdateIssues,
} from '@/services/issues.service';

// Bulk operations over the selected issues, each a single request to the batch
// endpoints. The bar calls these with the current id set; cache updates and
// invalidation live in the mutations.
export function useBulkActions(project: ProjectDetail) {
  const key = project.project.key;
  const update = useBulkUpdateIssues(key);
  const addLabels = useBulkAddLabels(key);
  const archive = useBulkArchiveIssues(key);
  const remove = useBulkDeleteIssues(key);

  return {
    patch: (ids: number[], patch: BulkIssuePatch) => update.mutateAsync({ ids, patch }),
    addLabel: (ids: number[], labelId: number) => addLabels.mutateAsync({ ids, add: [labelId] }),
    // Both removals carry what happens to the subtasks of the selected issues,
    // which the API requires whenever the selection has any.
    archiveAll: (ids: number[], subtasks?: SubtaskDisposition) =>
      archive.mutateAsync({ ids, subtasks }),
    deleteAll: (ids: number[], subtasks?: SubtaskDisposition) =>
      remove.mutateAsync({ ids, subtasks }),
    pending: update.isPending || addLabels.isPending || archive.isPending || remove.isPending,
  };
}
