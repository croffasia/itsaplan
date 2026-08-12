import { useState } from 'react';
import { type SubtaskDisposition, type SubtaskMode } from '@/lib/api';
import { cn } from '@/lib/utils';
import IssuePickerDialog from '@/components/common/overlay/IssuePickerDialog';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';

// What happens to the subtasks of the issues being removed. Shown inside the
// delete and archive confirmations whenever the selection has any: nothing is
// removed until this is answered.
export default function SubtaskDisposalChoice({
  projectKey,
  action,
  count,
  removedIssueIds,
  value,
  onChange,
}: {
  projectKey: string;
  action: 'delete' | 'archive';
  count: number;
  // The issues being removed, which their own subtasks cannot be moved to.
  removedIssueIds: number[];
  // The choice made so far, null until one is made — the confirmation stays
  // disabled while it is.
  value: SubtaskDisposition | null;
  onChange: (disposition: SubtaskDisposition) => void;
}) {
  const t = useTranslations('issue.subtaskDisposal');
  const [picking, setPicking] = useState(false);
  const [newParent, setNewParent] = useState<string | null>(null);

  const them = count === 1 ? 'it' : 'them';
  const options: { mode: SubtaskMode; label: string }[] = [
    {
      mode: 'cascade',
      label: action === 'delete' ? t('deleteToo', { count }) : t('archiveToo', { count }),
    },
    { mode: 'detach', label: t('detach', { count }) },
    { mode: 'reassign', label: t('reassign', { count }) },
  ];

  return (
    <div className="space-y-2 rounded-md border p-3">
      <p className="text-sm text-foreground">
        {t('intro', { issues: removedIssueIds.length, count })}
        {count === 1 ? '' : 's'}. Choose what happens to {them}.
      </p>
      <div className="flex flex-col gap-1">
        {options.map((option) => (
          <button
            key={option.mode}
            type="button"
            className={cn(
              'rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent/50',
              value?.subtasks === option.mode && 'bg-accent font-medium',
            )}
            onClick={() => {
              if (option.mode === 'reassign') setPicking(true);
              else onChange({ subtasks: option.mode });
            }}
          >
            {option.label}
          </button>
        ))}
      </div>

      {value?.subtasks === 'reassign' && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          New parent: <span className="font-mono text-foreground">{newParent}</span>
          <Button variant="ghost" size="sm" className="h-6" onClick={() => setPicking(true)}>
            {t('change')}
          </Button>
        </p>
      )}

      {picking && (
        <IssuePickerDialog
          projectKey={projectKey}
          title={t('reassignTitle')}
          prompt={t('searchParent')}
          // A subtask cannot be the parent of another, and neither can an issue
          // that is being removed here.
          exclude={(hit) => hit.parentId !== null || removedIssueIds.includes(hit.id)}
          onPick={(hit) => {
            setNewParent(hit.identifier);
            onChange({ subtasks: 'reassign', newParentId: hit.id });
            setPicking(false);
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  );
}
