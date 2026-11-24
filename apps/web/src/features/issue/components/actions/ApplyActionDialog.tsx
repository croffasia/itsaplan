import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';
import { useEffectText } from '@/hooks/useEffectText';
import { ApiError } from '@/lib/api/core/client';
import type { ActionDef } from '@/lib/api/endpoints/actions';
import type { Issue } from '@/lib/api/endpoints/issues';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import { useUpdateIssue } from '@/services/issues.service';
import { qk } from '@/services/queryKeys';
import { availableActionEffect, describeEffect, isEmptyEffect } from '@/utils/actions';

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
  const qc = useQueryClient();
  const projectKey = project.project.ref;
  const updateIssue = useUpdateIssue(projectKey);
  const effect = availableActionEffect(action.effect, project, issue);
  const effectText = useEffectText();
  const lines = describeEffect(effect, project, effectText);

  async function confirm() {
    try {
      await updateIssue.mutateAsync({ id: issue.id, patch: effect, actionId: action.id });
    } catch (error) {
      if (!(error instanceof ApiError) || error.code !== 'ACTION_EFFECT_CHANGED') throw error;
      await Promise.all([
        qc.invalidateQueries({ queryKey: qk.actions(projectKey) }),
        qc.invalidateQueries({ queryKey: qk.project(projectKey) }),
      ]);
    }
    onClose();
  }

  return (
    <ConfirmDialog
      title={action.name}
      confirmLabel={t('apply')}
      confirmDisabled={isEmptyEffect(effect)}
      onConfirm={confirm}
      onClose={onClose}
    >
      <div className="text-sm text-muted-foreground">
        <p>
          {t.rich('applyDescription', {
            action: action.name,
            v: (chunks: ReactNode) => <span className="font-medium text-foreground">{chunks}</span>,
          })}
        </p>
        {lines.length > 0 && (
          <ul className="mt-2 space-y-0.5">
            {lines.map((line) => (
              <li key={line.key} className="text-foreground">
                {line.text}
              </li>
            ))}
          </ul>
        )}
      </div>
    </ConfirmDialog>
  );
}
