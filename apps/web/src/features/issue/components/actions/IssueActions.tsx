import type { ActionDef, ProjectDetail, Issue } from '@/lib/api';
import { matchesFilterSet } from '@/utils/filters';
import { describeEffect } from '@/utils/actions';
import { useDeleteIssue, useUpdateIssue } from '@/services/issues.service';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';

// The project's manual actions whose condition matches this issue, in saved
// order. Shared by the issue detail Actions block and the context menu.
export function matchedActions(
  actions: ActionDef[],
  project: ProjectDetail,
  issue: Issue,
): ActionDef[] {
  return actions.filter((a) => matchesFilterSet(issue, a.condition, project));
}

// The confirm-dialog body for running an action: the changes it will apply, one
// per line.
function EffectSummary({ action, project }: { action: ActionDef; project: ProjectDetail }) {
  const lines = describeEffect(action.effect, project);
  return (
    <div className="text-sm text-muted-foreground">
      <p>
        Apply <span className="font-medium text-foreground">{action.name}</span> to this issue?
      </p>
      {lines.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {lines.map((l) => (
            <li key={l.key} className="text-foreground">
              {l.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Confirm and run a issue delete. Owns the mutation; the caller owns whether the
// dialog is mounted and leaves the deleted issue via onDeleted. Shared by the
// issue detail Actions bar and the context menu.
export function DeleteIssueDialog({
  project,
  issue,
  onClose,
  onDeleted,
}: {
  project: ProjectDetail;
  issue: Issue;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const deleteIssue = useDeleteIssue(project.project.key);
  return (
    <ConfirmDialog
      title="Delete issue"
      confirmLabel="Delete issue"
      onConfirm={async () => {
        await deleteIssue.mutateAsync(issue.id);
        onClose();
        onDeleted?.();
      }}
      onClose={onClose}
    >
      <p className="text-sm text-muted-foreground">
        Delete {issue.identifier}? This removes the issue, its comments, activity and attachments.
        This cannot be undone.
      </p>
    </ConfirmDialog>
  );
}

// Confirm and apply one manual action's effect as a single patch. Owns the
// mutation; the caller owns whether the dialog is mounted.
export function ApplyActionDialog({
  project,
  issue,
  action,
  onClose,
}: {
  project: ProjectDetail;
  issue: Issue;
  action: ActionDef;
  onClose: () => void;
}) {
  const updateIssue = useUpdateIssue(project.project.key);
  return (
    <ConfirmDialog
      title={action.name}
      confirmLabel="Apply"
      onConfirm={async () => {
        await updateIssue.mutateAsync({ id: issue.id, patch: action.effect });
        onClose();
      }}
      onClose={onClose}
    >
      <EffectSummary action={action} project={project} />
    </ConfirmDialog>
  );
}
