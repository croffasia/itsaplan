import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import type { AutoArchiveForm } from '../../hooks/useAutoArchiveForm';

// Only an owner may edit; others see the values read-only.
export default function SettingsArchive({ form }: { form: AutoArchiveForm }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="divide-y divide-border rounded-lg border border-border">
        <ThresholdRow
          label="Completed issues"
          on={form.completedOn}
          days={form.completedDays}
          editable={form.editable}
          onToggle={form.setCompletedOn}
          onDays={form.setCompletedDays}
        />
        <ThresholdRow
          label="Canceled issues"
          on={form.canceledOn}
          days={form.canceledDays}
          editable={form.editable}
          onToggle={form.setCanceledOn}
          onDays={form.setCanceledDays}
        />
      </div>
    </section>
  );
}

function ThresholdRow({
  label,
  on,
  days,
  editable,
  onToggle,
  onDays,
}: {
  label: string;
  on: boolean;
  days: string;
  editable: boolean;
  onToggle: (v: boolean) => void;
  onDays: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Switch checked={on} onCheckedChange={onToggle} disabled={!editable} />
      <span className="flex-1 text-sm">{label}</span>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={1}
          value={days}
          onChange={(e) => onDays(e.target.value)}
          disabled={!editable || !on}
          className="h-8 w-20"
        />
        <span className="text-sm text-muted-foreground">days</span>
      </div>
    </div>
  );
}
