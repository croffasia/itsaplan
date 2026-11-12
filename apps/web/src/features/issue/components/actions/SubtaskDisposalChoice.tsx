import { useState } from 'react';
import type { SubtaskDisposition, SubtaskMode } from '@/lib/api/endpoints/issues';
import { cn } from '@/lib/utils';
import { useIssueSubtreeQuery } from '@/services/issues.service';
import IssuePickerDialog from '@/components/common/overlay/IssuePickerDialog';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';
import IssueSubtaskTree, { type SubtreeOutcome } from './IssueSubtaskTree';

// What happens to the subtasks of the issues being removed. Shown inside the
// delete and archive confirmations whenever the selection has any: nothing is
// removed until this is answered. The tree beside the choice shows every level and
// what the chosen option does to each issue.
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
  // How many subtasks sit directly under the issues being removed.
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
  const [newParent, setNewParent] = useState<{ identifier: string; title: string } | null>(null);
  const subtree = useIssueSubtreeQuery(projectKey, removedIssueIds).data;
  const total = subtree?.length ?? count;
  const nested = subtree?.some((issue) => !removedIssueIds.includes(issue.parentId)) ?? false;
  const mode = value?.subtasks ?? null;
  const keepsOwn = nested ? ` ${t('nestedGoAlong', { count })}` : '';

  const options: { mode: SubtaskMode; label: string; hint: string }[] = [
    {
      mode: 'cascade',
      label: t(action === 'delete' ? 'deleteToo' : 'archiveToo', { count: total }),
      hint: t(action === 'delete' ? 'cascadeDeleteHint' : 'cascadeArchiveHint', { count: total }),
    },
    {
      mode: 'detach',
      label: t('detach', { count: total }),
      hint: t('detachHint', { count }) + keepsOwn,
    },
    {
      mode: 'reassign',
      label: t('reassign', { count: total }),
      hint: t('reassignHint', { count }) + keepsOwn,
    },
  ];
  const outcome: SubtreeOutcome =
    mode === 'cascade'
      ? action
      : mode === 'detach'
        ? 'detach'
        : mode === 'reassign'
          ? 'move'
          : null;

  return (
    <div className="grid items-start gap-6 sm:grid-cols-2">
      <fieldset className="min-w-0 space-y-1">
        <legend className="mb-2 text-sm font-medium">
          {t('question', { issues: removedIssueIds.length, count: total })}
        </legend>
        {options.map((option) => (
          <div
            key={option.mode}
            className={cn(
              'rounded-lg px-3 py-2.5 transition-colors',
              mode === option.mode ? 'bg-secondary' : 'hover:bg-accent',
            )}
          >
            <label className="flex cursor-pointer gap-3">
              <input
                type="radio"
                name={`subtasks-${action}`}
                checked={mode === option.mode}
                onChange={() => {
                  if (option.mode === 'reassign') setPicking(true);
                  else onChange({ subtasks: option.mode });
                }}
                className="mt-1 size-4 shrink-0 cursor-pointer accent-foreground"
              />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm font-medium">{option.label}</span>
                <span className="text-sm text-muted-foreground">{option.hint}</span>
              </span>
            </label>
            {option.mode === 'reassign' && mode === 'reassign' && newParent && (
              <div className="mt-2 flex min-w-0 items-center gap-2 ps-7 text-sm">
                <span className="shrink-0 whitespace-nowrap text-muted-foreground">
                  {t('newParent')}
                </span>
                <span className="flex min-w-0 items-center gap-1.5 rounded-md bg-background px-2 py-0.5">
                  <span dir="ltr" className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {newParent.identifier}
                  </span>
                  <span dir="auto" className="truncate">
                    {newParent.title}
                  </span>
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 shrink-0 px-2"
                  onClick={() => setPicking(true)}
                >
                  {t('change')}
                </Button>
              </div>
            )}
          </div>
        ))}
      </fieldset>

      {subtree && subtree.length > 0 && (
        <IssueSubtaskTree
          projectKey={projectKey}
          rootIds={removedIssueIds}
          issues={subtree}
          outcome={outcome}
          newParent={newParent?.identifier ?? null}
        />
      )}

      {picking && (
        <IssuePickerDialog
          projectKey={projectKey}
          title={t('reassignTitle')}
          prompt={t('searchParent')}
          // Neither an issue being removed here nor its subtasks can take them.
          // The API rejects one further down, or one that nests them too deep.
          exclude={(hit) =>
            removedIssueIds.includes(hit.id) ||
            (hit.parentId !== null && removedIssueIds.includes(hit.parentId))
          }
          onPick={(hit) => {
            setNewParent({ identifier: hit.identifier, title: hit.title });
            onChange({ subtasks: 'reassign', newParentId: hit.id });
            setPicking(false);
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  );
}
