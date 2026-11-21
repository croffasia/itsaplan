import { useState } from 'react';
import type { ActionDef, ActionEffect } from '@/lib/api/endpoints/actions';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import type { Issue, SubtaskDisposition } from '@/lib/api/endpoints/issues';
import { availableActionEffect, describeEffect, isEmptyEffect } from '@/utils/actions';
import { useEffectText } from '@/hooks/useEffectText';
import { dispositionReady, removalCount } from '@/utils/subtasks';
import {
  useDeleteIssue,
  useIssueQuery,
  useIssueSubtreeQuery,
  useUpdateIssue,
} from '@/services/issues.service';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';
import SubtaskDisposalChoice from './SubtaskDisposalChoice';
import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';

// The confirm-dialog body for running an action: the changes it will apply, one
// per line.
function EffectSummary({
  name,
  effect,
  project,
}: {
  name: string;
  effect: ActionEffect;
  project: ProjectDetail;
}) {
  const t = useTranslations('issue.actions');
  const effectText = useEffectText();
  const lines = describeEffect(effect, project, effectText);
  return (
    <div className="text-sm text-muted-foreground">
      <p>
        {t.rich('applyDescription', {
          action: name,
          v: (chunks: ReactNode) => <span className="font-medium text-foreground">{chunks}</span>,
        })}
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
  const t = useTranslations('issue.actions');
  const tr = useTranslations('workItems.removal');
  const deleteIssue = useDeleteIssue(project.project.ref);
  // The board carries only active issues, so an archived issue's subtasks are not
  // countable from it. The detail read carries them, archived ones included; it is
  // already cached on the issue page and fetched once when the dialog opens
  // elsewhere, which is what holds the confirmation until the count is known.
  const detail = useIssueQuery(issue.id);
  const subtasks = detail.data?.subtasks.length ?? 0;
  const [disposition, setDisposition] = useState<SubtaskDisposition | null>(null);
  const subtree = useIssueSubtreeQuery(project.project.ref, [issue.id], subtasks > 0).data;
  const removed = removalCount([issue.id], subtree ?? [], disposition);

  return (
    <ConfirmDialog
      title={t('deleteQuestion', { issue: issue.identifier })}
      confirmLabel={removed > 1 ? tr('delete.confirm', { count: removed }) : t('deleteTitle')}
      wide={subtasks > 0 && 'xl'}
      confirmDisabled={!detail.data || (subtasks > 0 && !dispositionReady(disposition))}
      onConfirm={async () => {
        await deleteIssue.mutateAsync({ id: issue.id, subtasks: disposition ?? undefined });
        onClose();
        onDeleted?.();
      }}
      onClose={onClose}
    >
      <p className="text-sm text-muted-foreground">
        {t('deleteDescription')} {t('cannotBeUndone')}
      </p>
      {subtasks > 0 && (
        <SubtaskDisposalChoice
          projectKey={project.project.ref}
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
  const t = useTranslations('issue.actions');
  const updateIssue = useUpdateIssue(project.project.ref);
  const effect = availableActionEffect(action.effect, project);
  return (
    <ConfirmDialog
      title={action.name}
      confirmLabel={t('apply')}
      confirmDisabled={isEmptyEffect(effect)}
      onConfirm={async () => {
        await updateIssue.mutateAsync({ id: issue.id, patch: effect, actionId: action.id });
        onClose();
      }}
      onClose={onClose}
    >
      <EffectSummary name={action.name} effect={effect} project={project} />
    </ConfirmDialog>
  );
}
