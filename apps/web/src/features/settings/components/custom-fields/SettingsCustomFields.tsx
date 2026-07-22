import { useState } from 'react';
import { ChevronRight, Plus } from 'lucide-react';
import { type CustomField, type NewCustomFieldInput, type ProjectDetail } from '@/lib/api';
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
import { SettingsCustomFieldForm, FIELD_TYPE_LABELS } from './SettingsCustomFieldForm';

// Which group's inline add form is open: 'global' for the project-wide field group,
// or a issue type id for a type-scoped group. null when no form is open.
type AddScope = 'global' | number;

export default function SettingsCustomFields({ project }: { project: ProjectDetail }) {
  const projectKey = project.project.key;
  const [addingScope, setAddingScope] = useState<AddScope | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<CustomField | null>(null);
  // Groups the user has collapsed, keyed by scope; every group is expanded by default.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const can = useSettingsCan();
  const createCustomField = useCreateCustomField(projectKey);
  const updateCustomField = useUpdateCustomField(projectKey);
  const deleteCustomField = useDeleteCustomField(projectKey);

  const fields = project.customFields;
  const groups: { scope: AddScope; label: string; fields: CustomField[] }[] = [
    {
      scope: 'global',
      label: 'Global (all types)',
      fields: fields.filter((f) => f.issueTypeId == null),
    },
    ...project.issueTypes.map((t) => ({
      scope: t.id as AddScope,
      label: t.name,
      fields: fields.filter((f) => f.issueTypeId === t.id),
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

  // Open the add form for a group, expanding it first so the form is visible.
  function openAdd(scope: AddScope) {
    setEditingId(null);
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.delete(String(scope));
      return next;
    });
    setAddingScope(scope);
  }

  async function add(scope: AddScope, input: Omit<NewCustomFieldInput, 'issueTypeId'>) {
    await createCustomField.mutateAsync({
      ...input,
      issueTypeId: scope === 'global' ? null : scope,
    });
    setAddingScope(null);
  }

  function startEdit(f: CustomField) {
    setAddingScope(null);
    setEditingId(f.id);
  }

  async function saveEdit(f: CustomField, values: { name: string; showInBody: boolean }) {
    await updateCustomField.mutateAsync({ id: f.id, patch: values });
    setEditingId(null);
  }

  function renderField(f: CustomField) {
    if (editingId === f.id) {
      return (
        <div key={f.id} className="py-1 pr-3 pl-9">
          <SettingsCustomFieldForm
            mode="edit"
            initial={f}
            onSubmit={(values) => void saveEdit(f, values)}
            onCancel={() => setEditingId(null)}
          />
        </div>
      );
    }
    const meta = [
      FIELD_TYPE_LABELS[f.fieldType],
      f.showInBody ? 'main info' : null,
      f.options.length ? f.options.map((o) => o.value).join(', ') : null,
    ]
      .filter(Boolean)
      .join(' · ');
    return (
      <SettingsRow
        key={f.id}
        className="h-11 pl-9"
        title={f.name}
        meta={meta}
        editTitle="Edit field"
        deleteTitle="Delete field"
        onEdit={() => startEdit(f)}
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
          const adding = addingScope === g.scope;
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
                    title="Add field"
                    aria-label={`Add field to ${g.label}`}
                    onClick={() => openAdd(g.scope)}
                  >
                    <Plus className="size-4" />
                  </Button>
                )}
              </div>

              {open && (
                <div className="pb-1">
                  {g.fields.map(renderField)}
                  {adding && (
                    <div className="py-1 pr-3 pl-9">
                      <SettingsCustomFieldForm
                        mode="add"
                        onSubmit={(input) => void add(g.scope, input)}
                        onCancel={() => setAddingScope(null)}
                      />
                    </div>
                  )}
                  {g.fields.length === 0 && !adding && (
                    <p className="py-3 pl-9 text-xs text-muted-foreground">No fields yet.</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {deleting && (
        <SettingsConfirmDeleteDialog
          title={`Delete field "${deleting.name}"`}
          confirmLabel="Delete field"
          message={
            <>
              This field and any values set for it on issues will be removed. This cannot be undone.
            </>
          }
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
