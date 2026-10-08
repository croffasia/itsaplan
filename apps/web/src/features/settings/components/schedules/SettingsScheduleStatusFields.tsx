import type { Column } from '@/lib/api/endpoints/columns';
import { colorDot } from '@/components/common/fields/colorDot';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SettingsScheduleField } from './SettingsScheduleField';
import { useTranslations } from 'next-intl';

export function SettingsScheduleStatusFields({
  columns,
  columnId,
  onColumnChange,
  delayMin,
  onDelayChange,
}: {
  columns: Column[];
  columnId: string;
  onColumnChange: (value: string) => void;
  delayMin: string;
  onDelayChange: (value: string) => void;
}) {
  const t = useTranslations('settings.schedules');
  return (
    <div className="space-y-1.5">
      <div className="grid gap-4 sm:grid-cols-2">
        <SettingsScheduleField htmlFor="schedule-column" label={t('column')}>
          <Select value={columnId} onValueChange={onColumnChange}>
            <SelectTrigger id="schedule-column" className="w-full" aria-required="true">
              <SelectValue placeholder={t('selectColumn')} />
            </SelectTrigger>
            <SelectContent>
              {columns.map((column) => (
                <SelectItem key={column.id} value={String(column.id)}>
                  {colorDot(column.color)}
                  {column.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsScheduleField>
        <SettingsScheduleField htmlFor="schedule-delay" label={t('delay')}>
          <div className="flex items-center gap-2">
            <Input
              id="schedule-delay"
              type="number"
              step="1"
              min="0"
              max="1440"
              value={delayMin}
              onChange={(event) => onDelayChange(event.target.value)}
            />
            <span className="text-xs text-muted-foreground">{t('minutes')}</span>
          </div>
        </SettingsScheduleField>
      </div>
      <p className="text-xs text-muted-foreground">{t('statusHint')}</p>
    </div>
  );
}
