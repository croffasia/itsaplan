import { useState } from 'react';
import { type ProjectDetail, type Column } from '@/lib/api';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDeleteColumn } from '../../services/settings.service';

export default function SettingsDeleteStateDialog({
  project,
  column,
  issueCount,
  onClose,
}: {
  project: ProjectDetail;
  column: Column;
  issueCount: number;
  onClose: () => void;
}) {
  const otherColumns = project.columns.filter((c) => c.id !== column.id);
  const [action, setAction] = useState<'move' | 'delete'>(otherColumns.length ? 'move' : 'delete');
  const [targetColumnId, setTargetColumnId] = useState<number | undefined>(otherColumns[0]?.id);
  const deleteColumn = useDeleteColumn(project.project.key);

  async function confirm() {
    const body =
      action === 'move' && targetColumnId != null
        ? ({ mode: 'move', targetColumnId } as const)
        : ({ mode: 'delete' } as const);
    await deleteColumn.mutateAsync({ id: column.id, body });
    onClose();
  }

  return (
    <ConfirmDialog
      title={`Delete state "${column.name}"`}
      confirmLabel={action === 'move' && issueCount > 0 ? 'Move & delete state' : 'Delete state'}
      confirmDisabled={action === 'move' && issueCount > 0 && targetColumnId == null}
      onConfirm={confirm}
      onClose={onClose}
    >
      {issueCount === 0 ? (
        <p className="text-sm text-muted-foreground">
          This state has no issues. It will be removed.
        </p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm">
            This state has {issueCount} issue{issueCount === 1 ? '' : 's'}. Choose what happens to
            them.
          </p>
          <div className="space-y-2">
            <Label>
              <Checkbox
                checked={action === 'move'}
                disabled={otherColumns.length === 0}
                onCheckedChange={(v) => v === true && setAction('move')}
              />
              Move issues to another state
            </Label>
            {action === 'move' && (
              <Select
                value={targetColumnId != null ? String(targetColumnId) : undefined}
                onValueChange={(v) => setTargetColumnId(Number(v))}
              >
                <SelectTrigger className="ml-6 w-[calc(100%-1.5rem)]">
                  <SelectValue placeholder="Select a state" />
                </SelectTrigger>
                <SelectContent>
                  {otherColumns.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name} ({c.stateType})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Label>
              <Checkbox
                checked={action === 'delete'}
                onCheckedChange={(v) => v === true && setAction('delete')}
              />
              <span className="text-destructive">Delete issues permanently</span>
            </Label>
          </div>
        </div>
      )}
    </ConfirmDialog>
  );
}
