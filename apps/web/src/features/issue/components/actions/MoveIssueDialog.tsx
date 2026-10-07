import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import type { Issue } from '@/lib/api/endpoints/issues';
import { useIssueQuery, useMoveIssue } from '@/services/issues.service';
import { useProjectQuery, useProjectsQuery } from '@/services/projects.service';
import { issuePath } from '@/utils/paths';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const MATCHING = 'matching';

// Moves the issue, with its subtasks, to another project of the same team and opens
// it under its new identifier.
export default function MoveIssueDialog({
  project,
  issue,
  onClose,
}: {
  project: ProjectDetail;
  issue: Issue;
  onClose: () => void;
}) {
  const t = useTranslations('issue.actions');
  const router = useRouter();
  const { data: projects } = useProjectsQuery();
  const targets = (projects ?? []).filter(
    (p) => p.teamId === project.project.teamId && p.id !== project.project.id && !p.archivedAt,
  );
  const [targetRef, setTargetRef] = useState<string | null>(null);
  const [column, setColumn] = useState(MATCHING);
  const target = targets.find((p) => p.ref === targetRef);
  const { data: targetDetail } = useProjectQuery(targetRef);
  const moveIssue = useMoveIssue(project.project.ref);
  const subtasks = useIssueQuery(issue.id).data?.subtasks.length ?? 0;

  return (
    <ConfirmDialog
      title={t('moveTitle')}
      confirmLabel={t('move')}
      confirmDisabled={!target}
      onConfirm={async () => {
        if (!target) return;
        const moved = await moveIssue.mutateAsync({
          id: issue.id,
          target,
          columnId: column === MATCHING ? undefined : Number(column),
        });
        onClose();
        router.push(issuePath(target.ref, moved.sequenceNumber));
      }}
      onClose={onClose}
    >
      <p className="text-sm text-muted-foreground">
        {t('moveDescription', { issue: issue.identifier })}{' '}
        {subtasks > 0 && t('moveSubtasks', { count: subtasks })}
      </p>
      <div className="space-y-1.5">
        <Label>{t('moveProject')}</Label>
        <Select
          value={targetRef ?? ''}
          onValueChange={(ref) => {
            setTargetRef(ref);
            setColumn(MATCHING);
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t('moveChooseProject')} />
          </SelectTrigger>
          <SelectContent>
            {targets.map((p) => (
              <SelectItem key={p.id} value={p.ref}>
                {p.name} ({p.key})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>{t('moveColumn')}</Label>
        <Select value={column} onValueChange={setColumn} disabled={!targetDetail}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={MATCHING}>{t('moveColumnMatching')}</SelectItem>
            {targetDetail?.columns.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <p className="text-xs text-muted-foreground">{t('moveCarriedOver')}</p>
    </ConfirmDialog>
  );
}
