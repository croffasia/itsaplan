import { Switch } from '@/components/ui/switch';

export default function DocumentShareToggle({
  label,
  hint,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  disabled: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className="-mx-1.5 flex cursor-pointer items-center gap-3 rounded-md px-1.5 py-2 transition-colors hover:bg-accent has-disabled:cursor-not-allowed">
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs leading-[1.45] text-muted-foreground">{hint}</span>
      </span>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
    </label>
  );
}
