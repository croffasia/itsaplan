import { useTranslations } from 'next-intl';
import SettingsRow from '@/components/common/page/SettingsRow';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

// One state group's auto-archive threshold: the switch that turns archiving on for
// the group and the day count it waits. The day count stays visible while the group
// is off, disabled, so the stored value is still readable.
export default function SettingsAutoArchiveRow({
  title,
  description,
  on,
  days,
  editable,
  onToggle,
  onDays,
}: {
  title: string;
  description: string;
  on: boolean;
  days: string;
  editable: boolean;
  onToggle: (v: boolean) => void;
  onDays: (v: string) => void;
}) {
  const t = useTranslations('settings.configuration');

  return (
    <SettingsRow
      title={title}
      description={description}
      control={
        <div className="flex shrink-0 items-center gap-3">
          <Input
            type="number"
            min={1}
            value={days}
            onChange={(e) => onDays(e.target.value)}
            disabled={!editable || !on}
            className="h-8 w-20"
          />
          <span className="text-xs text-muted-foreground">{t('days')}</span>
          <Switch checked={on} onCheckedChange={onToggle} disabled={!editable} />
        </div>
      }
    />
  );
}
