import { useEffect, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type IssueType, type ProjectDetail } from '@/lib/api';
import { DEFAULT_COLOR } from '@/utils/project';
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
import { EmptyState } from '@/components/common/page/EmptyState';
import SettingsColorField from '../crud/SettingsColorField';
import SettingsConfirmDeleteDialog from '../crud/SettingsConfirmDeleteDialog';
import { SettingsInlineForm } from '../crud/SettingsInlineForm';
import { useSettingsCan } from '../../context/settingsPermission';
import {
  useCreateIssueType,
  useDeleteIssueType,
  useUpdateIssueType,
} from '../../services/settings.service';

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
  const t = useTranslations('settings.issueTypes');
  const tCommon = useTranslations('common');
  const can = useSettingsCan();
  const createIssueType = useCreateIssueType(project.project.key);
  const updateIssueType = useUpdateIssueType(project.project.key);
  const deleteIssueType = useDeleteIssueType(project.project.key);

  const types = project.issueTypes;
  const issueCount = (typeId: number) =>
    project.issues.filter((issue) => issue.typeId === typeId).length;

  useEffect(() => {
    if (adding) {
      setEditingId(null);
      setName('');
      setColor(DEFAULT_COLOR);
      setIsDefault(false);
    }
  }, [adding]);

  function startEdit(type: IssueType) {
    onAddingChange(false);
    setEditingId(type.id);
    setName(type.name);
    setColor(type.color);
    setIsDefault(type.isDefault);
  }

  async function add() {
    if (!name.trim()) return;
    await createIssueType.mutateAsync({ name: name.trim(), color, isDefault });
    onAddingChange(false);
  }

  async function saveEdit(type: IssueType) {
    if (!name.trim()) return;
    await updateIssueType.mutateAsync({
      id: type.id,
      patch: { name: name.trim(), color, isDefault },
    });
    setEditingId(null);
  }

  // The "Default" checkbox shown in the add/edit form; `id` keeps the label's
  // htmlFor unique per row.
  const defaultToggle = (id: string) => (
    <div className="flex items-center gap-1.5">
      <Checkbox id={id} checked={isDefault} onCheckedChange={(v) => setIsDefault(v === true)} />
      <Label htmlFor={id} className="text-xs whitespace-nowrap text-muted-foreground">
        {t('default')}
      </Label>
    </div>
  );

  // While there are no types and none is being added, the empty state replaces the
  // list. Its add action lives in the page header, so it carries no button here.
  const showEmpty = types.length === 0 && !adding;
  const deletingCount = deleting ? issueCount(deleting.id) : 0;

  if (showEmpty) {
    return <EmptyState title={t('emptyTitle')} description={t('emptyHint')} />;
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
      placeholder={t('namePlaceholder')}
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
            <TableHead className="text-xs font-medium text-muted-foreground">
              {t('columns.type')}
            </TableHead>
            <TableHead className="text-xs font-medium text-muted-foreground">
              {t('columns.issues')}
            </TableHead>
            <TableHead className="text-right text-xs font-medium text-muted-foreground">
              {tCommon('actions')}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {types.map((type) =>
            editingId === type.id ? (
              <TableRow key={type.id} className="hover:bg-transparent">
                <TableCell colSpan={3} className="px-3 py-2">
                  {inlineForm(
                    tCommon('save'),
                    () => void saveEdit(type),
                    () => setEditingId(null),
                    `type-default-edit-${type.id}`,
                  )}
                </TableCell>
              </TableRow>
            ) : (
              <TableRow key={type.id} className="group/item">
                <TableCell className="px-3 py-3 align-middle">
                  <div className="flex min-w-0 items-center gap-2">
                    {colorDot(type.color)}
                    <span className="truncate text-sm font-medium">{type.name}</span>
                    {type.isDefault && (
                      <span className="rounded bg-secondary px-1.5 py-0.5 text-[11px] font-medium text-secondary-foreground">
                        {t('default')}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="px-3 py-3 align-middle text-sm text-muted-foreground tabular-nums">
                  {t('issueCount', { count: issueCount(type.id) })}
                </TableCell>
                <TableCell className="px-3 py-2 align-middle">
                  <div className="flex items-center justify-end gap-1">
                    {can('edit') && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-foreground"
                        title={t('edit')}
                        aria-label={t('edit')}
                        onClick={() => startEdit(type)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                    )}
                    {can('delete') && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        title={t('delete')}
                        aria-label={t('delete')}
                        onClick={() => setDeleting(type)}
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
                  tCommon('add'),
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
          title={t('deleteTitle', { name: deleting.name })}
          confirmLabel={t('deleteConfirm')}
          message={t('deleteMessage', { count: deletingCount })}
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
