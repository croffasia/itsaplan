import { Checkbox } from '@/components/ui/checkbox';

interface NotificationChannelCell {
  channel: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}

// One event, with a checkbox per channel. `cols` is the grid template of the header row,
// so the boxes line up under their channel names.
export default function NotificationChannelRow({
  label,
  cols,
  cells,
}: {
  label: string;
  cols: string;
  cells: NotificationChannelCell[];
}) {
  return (
    <div className={`${cols} -mx-3 rounded-md px-3 py-2.5 transition-colors hover:bg-accent`}>
      <span className="text-sm">{label}</span>
      {cells.map((cell) => (
        <div key={cell.channel} className="flex justify-center">
          <Checkbox
            checked={cell.checked}
            onCheckedChange={(v) => cell.onChange(v === true)}
            aria-label={`${label} — ${cell.channel}`}
          />
        </div>
      ))}
    </div>
  );
}
