import { useState } from 'react';
import type { ActionDef, ProjectDetail, Issue, SubtaskDisposition } from '@/lib/api';
import { matchesFilterSet } from '@/utils/filters';
import { describeEffect } from '@/utils/actions';
import { dispositionReady } from '@/utils/subtasks';
import { useDeleteIssue, useIssueQuery, useUpdateIssue } from '@/services/issues.service';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';
import SubtaskDisposalChoice from './SubtaskDisposalChoice';

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
  // The board carries only active issues, so an archived issue's subtasks are not
  // countable from it. The detail read carries them, archived ones included; it is
  // already cached on the issue page and fetched once when the dialog opens
  // elsewhere, which is what holds the confirmation until the count is known.
  const detail = useIssueQuery(issue.id);
  const subtasks = detail.data?.subtasks.length ?? 0;
  const [disposition, setDisposition] = useState<SubtaskDisposition | null>(null);

  return (
    <ConfirmDialog
      title="Delete issue"
      confirmLabel="Delete issue"
      confirmDisabled={!detail.data || (subtasks > 0 && !dispositionReady(disposition))}
      onConfirm={async () => {
        await deleteIssue.mutateAsync({ id: issue.id, subtasks: disposition ?? undefined });
        onClose();
        onDeleted?.();
      }}
      onClose={onClose}
    >
      <p className="text-sm text-muted-foreground">
        Delete {issue.identifier}? This removes the issue, its comments, activity and attachments.
        This cannot be undone.
      </p>
      {subtasks > 0 && (
        <SubtaskDisposalChoice
          projectKey={project.project.key}
          action="delete"
          count={subtasks}
          removedIssueIds={[issue.id]}
          value={disposition}
          onChange={setDisposition}
        />
      )}
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
