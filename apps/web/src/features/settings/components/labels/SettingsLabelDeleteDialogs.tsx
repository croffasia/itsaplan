import { type Label as LabelRow, type LabelGroup } from '@/lib/api';
import SettingsConfirmDeleteDialog from '../crud/SettingsConfirmDeleteDialog';

export function SettingsLabelDeleteDialog({
  label,
  issueCount,
  onClose,
  onConfirm,
}: {
  label: LabelRow;
  issueCount: number;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  return (
    <SettingsConfirmDeleteDialog
      title={`Delete label "${label.name}"`}
      confirmLabel="Delete label"
      message={
        <>
          {issueCount > 0
            ? `This label is on ${issueCount} issue${issueCount === 1 ? '' : 's'} and will be removed from ${issueCount === 1 ? 'it' : 'them'}.`
            : 'No issues use this label.'}{' '}
          This cannot be undone.
        </>
      }
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}

export function SettingsLabelGroupDeleteDialog({
  group,
  labelCount,
  onClose,
  onConfirm,
}: {
  group: LabelGroup;
  labelCount: number;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  return (
    <SettingsConfirmDeleteDialog
      title={`Delete group "${group.name}"`}
      confirmLabel="Delete group"
      message={
        <>
          {labelCount > 0
            ? `${labelCount} label${labelCount === 1 ? '' : 's'} will be ungrouped but kept.`
            : 'This group has no labels.'}{' '}
          This cannot be undone.
        </>
      }
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}
