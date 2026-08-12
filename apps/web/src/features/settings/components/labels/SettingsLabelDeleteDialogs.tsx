import { useTranslations } from 'next-intl';
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
  const t = useTranslations('settings.labels');
  return (
    <SettingsConfirmDeleteDialog
      title={t('deleteLabelTitle', { name: label.name })}
      confirmLabel={t('deleteLabel')}
      message={t('deleteLabelMessage', { count: issueCount })}
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
  const t = useTranslations('settings.labels');
  return (
    <SettingsConfirmDeleteDialog
      title={t('deleteGroupTitle', { name: group.name })}
      confirmLabel={t('deleteGroup')}
      message={t('deleteGroupMessage', { count: labelCount })}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}
