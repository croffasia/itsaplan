import { Switch } from '@/components/ui/switch';

export default function EnabledSwitch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-muted-foreground">
      Enabled
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </label>
  );
}
