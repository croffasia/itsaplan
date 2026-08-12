import { Switch } from '@/components/ui/switch';
import { useTranslations } from 'next-intl';

export default function EnabledSwitch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled: boolean;
}) {
  const t = useTranslations('common');
  return (
    <label className="flex items-center gap-2 text-sm text-muted-foreground">
      {t('enabled')}
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </label>
  );
}
