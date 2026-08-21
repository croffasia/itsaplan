import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronRight, Plus } from 'lucide-react';
import { type CustomField, type ProjectDetail } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import SettingsConfirmDeleteDialog from '../crud/SettingsConfirmDeleteDialog';
import { SettingsRow } from '../crud/SettingsRow';
import { useSettingsCan } from '../../context/settingsPermission';
import {
  useCreateCustomField,
  useDeleteCustomField,
  useUpdateCustomField,
} from '../../services/settings.service';
import CustomFieldMeta from './CustomFieldMeta';
import SettingsCustomFieldDialog, { type FieldFormValues } from './SettingsCustomFieldDialog';

// Which group the add dialog is open for: 'global' for the project-wide field group,
// or a issue type id for a type-scoped group. null when no dialog is open.
type AddScope = 'global' | number;

export default function SettingsCustomFields({ project }: { project: ProjectDetail }) {
  const projectKey = project.project.key;
  const [addingScope, setAddingScope] = useState<AddScope | null>(null);
  const [editing, setEditing] = useState<CustomField | null>(null);
  const [deleting, setDeleting] = useState<CustomField | null>(null);
  // Groups the user has collapsed, keyed by scope; every group is expanded by default.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const t = useTranslations('settings.customFields');
  const can = useSettingsCan();
  const createCustomField = useCreateCustomField(projectKey);
  const updateCustomField = useUpdateCustomField(projectKey);
  const deleteCustomField = useDeleteCustomField(projectKey);

  const fields = project.customFields;
  const groups: { scope: AddScope; label: string; fields: CustomField[] }[] = [
    {
      scope: 'global',
      label: t('global'),
      fields: fields.filter((f) => f.issueTypeId == null),
    },
    ...project.issueTypes.map((type) => ({
      scope: type.id as AddScope,
      label: type.name,
      fields: fields.filter((f) => f.issueTypeId === type.id),
    })),
  ];

  function toggle(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function add(scope: AddScope, values: FieldFormValues) {
    await createCustomField.mutateAsync({
      name: values.name,
      fieldType: values.fieldType,
      memberScope: values.memberScope,
      showInBody: values.showInBody,
      options: values.options.map((o) => o.value),
      issueTypeId: scope === 'global' ? null : scope,
    });
    setAddingScope(null);
  }

  async function saveEdit(id: number, values: FieldFormValues) {
    await updateCustomField.mutateAsync({
      id,
      patch: {
        name: values.name,
        showInBody: values.showInBody,
        fieldType: values.fieldType,
        memberScope: values.memberScope,
        options: values.options,
      },
    });
    setEditing(null);
  }

  function groupLabel(scope: AddScope): string {
    return groups.find((g) => g.scope === scope)?.label ?? '';
  }

  function renderField(f: CustomField) {
    return (
      <SettingsRow
        key={f.id}
        className="h-11 pl-9"
        title={f.name}
        meta={<CustomFieldMeta field={f} />}
        editTitle={t('editField')}
        deleteTitle={t('deleteField')}
        onEdit={() => setEditing(f)}
        onDelete={() => setDeleting(f)}
      />
    );
  }

  return (
    <div>
      <div className="divide-y divide-border/50">
        {groups.map((g) => {
          const key = String(g.scope);
          const open = !collapsed.has(key);
          return (
            <div key={key}>
              <div className="flex h-11 items-center gap-2 rounded-md pr-2 transition-colors hover:bg-accent/50">
                <button
                  type="button"
                  onClick={() => toggle(key)}
                  aria-expanded={open}
                  className="flex h-full min-w-0 flex-1 items-center gap-2 px-3 text-left outline-none"
                >
                  <ChevronRight
                    className={cn(
                      'size-4 shrink-0 text-muted-foreground transition-transform',
                      open && 'rotate-90',
                    )}
                  />
                  <span className="truncate text-sm font-semibold tracking-tight text-foreground">
                    {g.label}
                  </span>
                  {g.fields.length > 0 && (
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {g.fields.length}
                    </span>
                  )}
                </button>
                {can('create') && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-foreground"
                    title={t('addField')}
                    aria-label={t('addFieldTo', { group: g.label })}
                    onClick={() => setAddingScope(g.scope)}
                  >
                    <Plus className="size-4" />
                  </Button>
                )}
              </div>

              {open && (
                <div className="pb-1">
                  {g.fields.map(renderField)}
                  {g.fields.length === 0 && (
                    <p className="py-3 pl-9 text-xs text-muted-foreground">{t('noFields')}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {addingScope !== null && (
        <SettingsCustomFieldDialog
          group={groupLabel(addingScope)}
          onSubmit={(values) => void add(addingScope, values)}
          onClose={() => setAddingScope(null)}
        />
      )}

      {editing && (
        <SettingsCustomFieldDialog
          group={groupLabel(editing.issueTypeId ?? 'global')}
          initial={editing}
          onSubmit={(values) => void saveEdit(editing.id, values)}
          onClose={() => setEditing(null)}
        />
      )}

      {deleting && (
        <SettingsConfirmDeleteDialog
          title={t('deleteTitle', { name: deleting.name })}
          confirmLabel={t('deleteField')}
          message={t('deleteMessage')}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await deleteCustomField.mutateAsync(deleting.id);
            setDeleting(null);
          }}
        />
      )}
    </div>
  );
}
