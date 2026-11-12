import { useState } from 'react';
import type { SubtaskDisposition } from '@/lib/api/endpoints/issues';
import { useIssueSubtreeQuery } from '@/services/issues.service';
import IssuePickerDialog from '@/components/common/overlay/IssuePickerDialog';
import { useTranslations } from 'next-intl';
import IssueSubtaskDisposalOptions, {
  type SubtaskDisposalOption,
} from './IssueSubtaskDisposalOptions';
import IssueSubtaskTree from './IssueSubtaskTree';

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
  // A selected issue under another selected one is removed, whatever the choice.
  const unselected = subtree?.filter((issue) => !removedIssueIds.includes(issue.id)) ?? [];
  const direct = subtree
    ? unselected.filter((issue) => removedIssueIds.includes(issue.parentId)).length
    : count;
  const keepsOwn = unselected.length > direct ? ` ${t('nestedGoAlong', { count: direct })}` : '';

  const options: SubtaskDisposalOption[] = [
    {
      mode: 'cascade',
      label: t(action === 'delete' ? 'deleteToo' : 'archiveToo', { count: total }),
      hint: t(action === 'delete' ? 'cascadeDeleteHint' : 'cascadeArchiveHint', { count: total }),
    },
    {
      mode: 'detach',
      label: t('detach', { count: total }),
      hint: t('detachHint', { count: direct }) + keepsOwn,
    },
    {
      mode: 'reassign',
      label: t('reassign', { count: total }),
      hint: t('reassignHint', { count: direct }) + keepsOwn,
    },
  ];

  return (
    <div className="grid items-start gap-6 sm:grid-cols-2">
      <IssueSubtaskDisposalOptions
        name={`subtasks-${action}`}
        legend={t('question', { issues: removedIssueIds.length, count: total })}
        options={options}
        mode={value?.subtasks ?? null}
        newParent={newParent}
        onSelect={(mode) => {
          if (mode === 'reassign') setPicking(true);
          else onChange({ subtasks: mode });
        }}
      />

      {subtree && subtree.length > 0 && (
        <IssueSubtaskTree
          projectKey={projectKey}
          rootIds={removedIssueIds}
          issues={subtree}
          removal={action}
          mode={value?.subtasks ?? null}
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
