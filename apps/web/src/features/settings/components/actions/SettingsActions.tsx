import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ActionDef, ActionEffect, ProjectDetail, CustomField } from '@/lib/api';
import {
  useActionsQuery,
  useCreateAction,
  useDeleteAction,
  useUpdateAction,
} from '@/services/actions.service';
import { EMPTY_FILTER_SET, type FilterSet } from '@/utils/filters';
import { EmptyState } from '@/components/common/page/EmptyState';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import SettingsConfirmDeleteDialog from '../crud/SettingsConfirmDeleteDialog';
import { SettingsActionDialog } from './SettingsActionDialog';
import { SettingsActionsTable } from './SettingsActionsTable';

type ActionSeed = { name: string; icon: string; condition: FilterSet; effect: ActionEffect };

// Project settings tab for manual actions. Each action is a saved macro: a
// condition selecting which issues it applies to and an effect applied in one
// issue update. The matching actions show on a issue's Actions block and
// context menu.
export default function SettingsActions({
  project,
  customFields,
  requestNew,
  onNewHandled,
}: {
  project: ProjectDetail;
  customFields: CustomField[];
  requestNew: boolean;
  onNewHandled: () => void;
}) {
  const t = useTranslations('settings.actions');
  const projectKey = project.project.key;
  const actionsQuery = useActionsQuery(projectKey);
  const actions = actionsQuery.data ?? [];
  const createAction = useCreateAction(projectKey);
  const updateAction = useUpdateAction(projectKey);
  const deleteAction = useDeleteAction(projectKey);
  // The action open in the editor: an action id, 'new' for the add form, or null.
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  // Prefill for the 'new' form when duplicating an existing action; null for a blank new action.
  const [newSeed, setNewSeed] = useState<ActionSeed | null>(null);
  const [deleting, setDeleting] = useState<ActionDef | null>(null);

  // The "New action" button lives in the page header; opening is signalled here.
  useEffect(() => {
    if (!requestNew) return;
    setNewSeed(null);
    setEditing('new');
    onNewHandled();
  }, [requestNew, onNewHandled]);

  function startDuplicate(action: ActionDef) {
    setNewSeed({
      name: t('copySuffix', { name: action.name }),
      icon: action.icon,
      condition: action.condition,
      effect: action.effect,
    });
    setEditing('new');
  }

  const saving = createAction.isPending || updateAction.isPending;
  const editingAction =
    typeof editing === 'number' ? actions.find((a) => a.id === editing) : undefined;
  const showDialog = editing === 'new' || editingAction != null;

  async function saveAction(input: ActionSeed) {
    if (editing === 'new') {
      await createAction.mutateAsync({ input });
    } else if (typeof editing === 'number') {
      await updateAction.mutateAsync({ id: editing, input });
    }
    setEditing(null);
  }

  return (
    <>
      {actionsQuery.isPending ? (
        <ListSkeleton rows={3} rowClassName="h-12" />
      ) : actions.length === 0 ? (
        <EmptyState title={t('emptyTitle')} description={t('emptyHint')} />
      ) : (
        <div className="space-y-4">
          <SettingsActionsTable
            actions={actions}
            project={project}
            customFields={customFields}
            onEdit={setEditing}
            onDuplicate={startDuplicate}
            onDelete={setDeleting}
          />
        </div>
      )}

      {showDialog && (
        <SettingsActionDialog
          key={editingAction?.id ?? 'new'}
          projectKey={projectKey}
          project={project}
          customFields={customFields}
          mode={editingAction ? 'edit' : 'new'}
          initialName={editingAction?.name ?? newSeed?.name ?? ''}
          initialIcon={editingAction?.icon ?? newSeed?.icon ?? ''}
          initialCondition={editingAction?.condition ?? newSeed?.condition ?? EMPTY_FILTER_SET}
          initialEffect={editingAction?.effect ?? newSeed?.effect ?? {}}
          saving={saving}
          onSave={saveAction}
          onClose={() => setEditing(null)}
        />
      )}

      {deleting && (
        <SettingsConfirmDeleteDialog
          title={t('deleteTitle', { name: deleting.name })}
          confirmLabel={t('delete')}
          message={t('deleteMessage')}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await deleteAction.mutateAsync(deleting.id);
            setDeleting(null);
          }}
        />
      )}
    </>
  );
}
