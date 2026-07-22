import type { WidgetConfig } from '@/utils/dashboardWidgets';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const DAYS_OPTIONS = [7, 30, 90];

// The window in days, shared by the health widgets (agent runs, webhook deliveries).
export default function WidgetDaysSettings({
  config,
  onConfigChange,
}: {
  config: WidgetConfig;
  onConfigChange: (config: WidgetConfig) => void;
}) {
  const days = config.days ?? 30;
  return (
    <Select value={String(days)} onValueChange={(v) => onConfigChange({ days: Number(v) })}>
      <SelectTrigger size="sm" className="w-[130px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {DAYS_OPTIONS.map((n) => (
          <SelectItem key={n} value={String(n)}>
            Last {n} days
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
