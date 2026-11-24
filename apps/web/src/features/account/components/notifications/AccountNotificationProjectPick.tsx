import { Checkbox } from '@/components/ui/checkbox';

// A project while several are being selected.
export default function AccountNotificationProjectPick({
  name,
  checked,
  onChange,
}: {
  name: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="-mx-3 flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm wrap-anywhere transition-colors hover:bg-accent">
      <Checkbox checked={checked} onCheckedChange={(on) => onChange(on === true)} />
      <span dir="auto">{name}</span>
    </label>
  );
}
