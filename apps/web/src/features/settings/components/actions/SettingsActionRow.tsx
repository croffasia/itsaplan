import { Copy, Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ActionDef, CustomField, ProjectDetail } from '@/lib/api';
import { useFilterFields } from '@/hooks/useFilterFields';
import { useEffectText } from '@/hooks/useEffectText';
import { describeEffect } from '@/utils/actions';
import { actionIcon } from '@/utils/actionIcons';
import { Badge } from '@/components/ui/badge';
import { TableCell, TableRow } from '@/components/ui/table';
import SettingsIconButton from '../SettingsIconButton';
import { useSettingsCan } from '../../context/settingsPermission';

export function SettingsActionRow({
  action,
  project,
  customFields,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  action: ActionDef;
  project: ProjectDetail;
  customFields: CustomField[];
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations('settings.actions');
  const can = useSettingsCan();
  const { describeConditions } = useFilterFields(project.project.key);
  const effectText = useEffectText();
  const conditions = describeConditions(action.condition, project, customFields);
  const effects = describeEffect(action.effect, project, effectText);
  const Icon = actionIcon(action.icon);
  return (
    <TableRow className="group/item">
      <TableCell className="px-3 py-3 align-top whitespace-normal">
        <div className="flex min-w-0 items-start gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <Icon className="size-4" />
          </div>
          <div className="flex min-w-0 flex-col gap-1.5 pt-1">
            <span className="truncate text-sm font-medium">{action.name}</span>
            {conditions.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-xs text-muted-foreground">{t('when')}</span>
                {conditions.map((text, i) => (
                  <Badge key={i} variant="secondary" className="font-normal">
                    {text}
                  </Badge>
                ))}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">{t('alwaysAvailable')}</span>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell className="px-3 py-3 pt-4 align-top whitespace-normal">
        {effects.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {effects.map((e) => (
              <Badge key={e.key} variant="secondary" className="font-normal">
                {e.text}
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">{t('noChanges')}</span>
        )}
      </TableCell>
      <TableCell className="px-3 py-2 pt-3 align-top">
        <div className="flex items-center justify-end gap-1">
          {can('edit') && (
            <SettingsIconButton title={t('edit')} onClick={onEdit}>
              <Pencil className="size-4" />
            </SettingsIconButton>
          )}
          {can('create') && (
            <SettingsIconButton title={t('duplicate')} onClick={onDuplicate}>
              <Copy className="size-4" />
            </SettingsIconButton>
          )}
          {can('delete') && (
            <SettingsIconButton title={t('delete')} destructive onClick={onDelete}>
              <Trash2 className="size-4" />
            </SettingsIconButton>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
