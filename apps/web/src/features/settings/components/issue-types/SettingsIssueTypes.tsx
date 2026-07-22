import { useEffect, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { type IssueType, type ProjectDetail } from '@/lib/api';
import { DEFAULT_COLOR } from '@/utils/project';
import { settingsSection } from '@/utils/settingsSections';
import { colorDot } from '@/components/common/fields/colorDot';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import SettingsColorField from '../crud/SettingsColorField';
import SettingsConfirmDeleteDialog from '../crud/SettingsConfirmDeleteDialog';
import { SettingsInlineForm } from '../crud/SettingsInlineForm';
import { SettingsListEmpty } from '../crud/SettingsListEmpty';
import { useSettingsCan } from '../../context/settingsPermission';
import {
  useCreateIssueType,
  useDeleteIssueType,
  useUpdateIssueType,
} from '../../services/settings.service';

const section = settingsSection('issue-types');

// The project's issue types. Adding is opened from the page header (the `adding`
// flag is lifted to the page); the add form itself is inline in this list.
export default function SettingsIssueTypes({
  project,
  adding,
  onAddingChange,
}: {
  project: ProjectDetail;
  adding: boolean;
  onAddingChange: (adding: boolean) => void;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [isDefault, setIsDefault] = useState(false);
  const [deleting, setDeleting] = useState<IssueType | null>(null);
  const can = useSettingsCan();
  const createIssueType = useCreateIssueType(project.project.key);
  const updateIssueType = useUpdateIssueType(project.project.key);
  const deleteIssueType = useDeleteIssueType(project.project.key);

  const types = project.issueTypes;
  const issueCount = (typeId: number) => project.issues.filter((t) => t.typeId === typeId).length;

  useEffect(() => {
    if (adding) {
      setEditingId(null);
      setName('');
      setColor(DEFAULT_COLOR);
      setIsDefault(false);
    }
  }, [adding]);

  function startEdit(t: IssueType) {
    onAddingChange(false);
    setEditingId(t.id);
    setName(t.name);
    setColor(t.color);
    setIsDefault(t.isDefault);
  }

  async function add() {
    if (!name.trim()) return;
    await createIssueType.mutateAsync({ name: name.trim(), color, isDefault });
    onAddingChange(false);
  }

  async function saveEdit(t: IssueType) {
    if (!name.trim()) return;
    await updateIssueType.mutateAsync({ id: t.id, patch: { name: name.trim(), color, isDefault } });
    setEditingId(null);
  }

  // The "Default" checkbox shown in the add/edit form; `id` keeps the label's
  // htmlFor unique per row.
  const defaultToggle = (id: string) => (
    <div className="flex items-center gap-1.5">
      <Checkbox id={id} checked={isDefault} onCheckedChange={(v) => setIsDefault(v === true)} />
      <Label htmlFor={id} className="text-xs whitespace-nowrap text-muted-foreground">
        Default
      </Label>
    </div>
  );

  // While there are no types and none is being added, the empty state replaces the
  // list. Its add action lives in the page header, so it carries no button here.
  const showEmpty = types.length === 0 && !adding;
  const deletingCount = deleting ? issueCount(deleting.id) : 0;

  if (showEmpty) {
    return (
      <SettingsListEmpty
        icon={section.icon}
        title="No issue types yet"
        description="Add the kinds of issues this project can hold, each with its own fields."
      />
    );
  }

  const inlineForm = (
    submitLabel: string,
    onSubmit: () => void,
    onCancel: () => void,
    key: string,
  ) => (
    <SettingsInlineForm
      name={name}
      onNameChange={setName}
      placeholder="Type name"
      submitLabel={submitLabel}
      onSubmit={onSubmit}
      onCancel={onCancel}
      leading={<SettingsColorField value={color} onChange={setColor} />}
      trailing={defaultToggle(key)}
    />
  );

  return (
    <div className="space-y-4">
      <Table className="min-w-[640px] table-fixed">
        <colgroup>
          <col className="w-[46%]" />
          <col className="w-[40%]" />
          <col className="w-[14%]" />
        </colgroup>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-xs font-medium text-muted-foreground">Type</TableHead>
            <TableHead className="text-xs font-medium text-muted-foreground">Issues</TableHead>
            <TableHead className="text-right text-xs font-medium text-muted-foreground">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {types.map((t) =>
            editingId === t.id ? (
              <TableRow key={t.id} className="hover:bg-transparent">
                <TableCell colSpan={3} className="px-3 py-2">
                  {inlineForm(
                    'Save',
                    () => void saveEdit(t),
                    () => setEditingId(null),
                    `type-default-edit-${t.id}`,
                  )}
                </TableCell>
              </TableRow>
            ) : (
              <TableRow key={t.id} className="group/item">
                <TableCell className="px-3 py-3 align-middle">
                  <div className="flex min-w-0 items-center gap-2">
                    {colorDot(t.color)}
                    <span className="truncate text-sm font-medium">{t.name}</span>
                    {t.isDefault && (
                      <span className="rounded bg-secondary px-1.5 py-0.5 text-[11px] font-medium text-secondary-foreground">
                        Default
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="px-3 py-3 align-middle text-sm text-muted-foreground tabular-nums">
                  {issueCount(t.id) === 0
                    ? 'No issues'
                    : `${issueCount(t.id)} ${issueCount(t.id) === 1 ? 'issue' : 'issues'}`}
                </TableCell>
                <TableCell className="px-3 py-2 align-middle">
                  <div className="flex items-center justify-end gap-1">
                    {can('edit') && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-foreground"
                        title="Edit issue type"
                        aria-label="Edit issue type"
                        onClick={() => startEdit(t)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                    )}
                    {can('delete') && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        title="Delete issue type"
                        aria-label="Delete issue type"
                        onClick={() => setDeleting(t)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ),
          )}
          {adding && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={3} className="px-3 py-2">
                {inlineForm(
                  'Add',
                  () => void add(),
                  () => onAddingChange(false),
                  'type-default-new',
                )}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {deleting && (
        <SettingsConfirmDeleteDialog
          title={`Delete type "${deleting.name}"`}
          confirmLabel="Delete type"
          message={
            <>
              {deletingCount > 0
                ? `${deletingCount} issue${deletingCount === 1 ? '' : 's'} ${deletingCount === 1 ? 'uses' : 'use'} this type and will no longer have a type.`
                : 'No issues use this type.'}{' '}
              Custom fields specific to this type are also removed. This cannot be undone.
            </>
          }
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await deleteIssueType.mutateAsync(deleting.id);
            setDeleting(null);
          }}
        />
      )}
    </div>
  );
}
