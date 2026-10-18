import { useEffect, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ProjectGroup } from '@/lib/api/endpoints/groups';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import { DEFAULT_COLOR } from '@/utils/project';
import { colorDot } from '@/components/common/fields/colorDot';
import { Button } from '@/components/ui/button';
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
  useCreateGroup,
  useDeleteGroup,
  useSetGroupMembers,
  useUpdateGroup,
} from '../../services/settings.service';
import SettingsGroupMembers from './SettingsGroupMembers';

// The project's assignee groups. Adding is opened from the page header (the `adding`
// flag is lifted to the page); the add form itself is inline in this list.
export default function SettingsGroups({
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
  const [deleting, setDeleting] = useState<ProjectGroup | null>(null);
  const t = useTranslations('settings.groups');
  const tCommon = useTranslations('common');
  const can = useSettingsCan();
  const projectKey = project.project.ref;
  const createGroup = useCreateGroup(projectKey);
  const updateGroup = useUpdateGroup(projectKey);
  const deleteGroup = useDeleteGroup(projectKey);
  const setMembers = useSetGroupMembers(projectKey);

  const groups = project.groups;
  const members = project.assignees.filter((a) => a.kind === 'member');
  const issueCount = (groupId: number) =>
    project.issues.filter((issue) => issue.assigneeGroupId === groupId).length;

  useEffect(() => {
    if (adding) {
      setEditingId(null);
      setName('');
      setColor(DEFAULT_COLOR);
    }
  }, [adding]);

  function startEdit(group: ProjectGroup) {
    onAddingChange(false);
    setEditingId(group.id);
    setName(group.name);
    setColor(group.color);
  }

  async function add() {
    if (!name.trim()) return;
    await createGroup.mutateAsync({ name: name.trim(), color });
    onAddingChange(false);
  }

  async function saveEdit(group: ProjectGroup) {
    if (!name.trim()) return;
    await updateGroup.mutateAsync({ id: group.id, patch: { name: name.trim(), color } });
    setEditingId(null);
  }

  if (groups.length === 0 && !adding) {
    return <EmptyState title={t('emptyTitle')} description={t('emptyHint')} />;
  }

  const inlineForm = (submitLabel: string, onSubmit: () => void, onCancel: () => void) => (
    <SettingsInlineForm
      name={name}
      onNameChange={setName}
      placeholder={t('namePlaceholder')}
      submitLabel={submitLabel}
      onSubmit={onSubmit}
      onCancel={onCancel}
      leading={<SettingsColorField value={color} onChange={setColor} />}
    />
  );

  return (
    <div className="space-y-4">
      <Table className="min-w-[640px] table-fixed">
        <colgroup>
          <col className="w-[34%]" />
          <col className="w-[28%]" />
          <col className="w-[22%]" />
          <col className="w-[16%]" />
        </colgroup>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-xs font-medium text-muted-foreground">
              {t('columns.group')}
            </TableHead>
            <TableHead className="text-xs font-medium text-muted-foreground">
              {t('columns.members')}
            </TableHead>
            <TableHead className="text-xs font-medium text-muted-foreground">
              {t('columns.issues')}
            </TableHead>
            <TableHead className="text-end text-xs font-medium text-muted-foreground">
              {tCommon('actions')}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((group) =>
            editingId === group.id ? (
              <TableRow key={group.id} className="hover:bg-transparent">
                <TableCell colSpan={4} className="px-3 py-2">
                  {inlineForm(
                    tCommon('save'),
                    () => void saveEdit(group),
                    () => setEditingId(null),
                  )}
                </TableCell>
              </TableRow>
            ) : (
              <TableRow key={group.id} className="group/item">
                <TableCell className="px-3 py-3 align-middle">
                  <div className="flex min-w-0 items-center gap-2">
                    {colorDot(group.color)}
                    <span className="truncate text-sm font-medium">{group.name}</span>
                  </div>
                </TableCell>
                <TableCell className="px-2 py-2 align-middle">
                  <SettingsGroupMembers
                    group={group}
                    members={members}
                    onChange={(userIds) => setMembers.mutate({ id: group.id, userIds })}
                  />
                </TableCell>
                <TableCell className="px-3 py-3 align-middle text-sm text-muted-foreground tabular-nums">
                  {t('issueCount', { count: issueCount(group.id) })}
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
                        onClick={() => startEdit(group)}
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
                        onClick={() => setDeleting(group)}
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
              <TableCell colSpan={4} className="px-3 py-2">
                {inlineForm(
                  tCommon('add'),
                  () => void add(),
                  () => onAddingChange(false),
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
          message={t('deleteMessage', { count: issueCount(deleting.id) })}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await deleteGroup.mutateAsync(deleting.id);
            setDeleting(null);
          }}
        />
      )}
    </div>
  );
}
