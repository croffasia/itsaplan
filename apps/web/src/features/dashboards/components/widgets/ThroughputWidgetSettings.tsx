import type { WidgetConfig } from '@/utils/dashboardWidgets';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const WEEK_OPTIONS = [4, 8, 12, 26];

// The number of weeks the chart covers.
export default function ThroughputWidgetSettings({
  config,
  onConfigChange,
}: {
  config: WidgetConfig;
  onConfigChange: (config: WidgetConfig) => void;
}) {
  const weeks = config.weeks ?? 12;
  return (
    <Select value={String(weeks)} onValueChange={(v) => onConfigChange({ weeks: Number(v) })}>
      <SelectTrigger size="sm" className="w-[130px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {WEEK_OPTIONS.map((w) => (
          <SelectItem key={w} value={String(w)}>
            Last {w} weeks
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
