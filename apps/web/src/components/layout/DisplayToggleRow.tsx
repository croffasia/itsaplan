import { Switch } from '@/components/ui/switch';

// The whole row is the label of its switch, so a click anywhere on it toggles.
export default function DisplayToggleRow({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-8 cursor-pointer items-center justify-between gap-2 rounded-md px-2 text-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground">
      {label}
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </label>
  );
}
