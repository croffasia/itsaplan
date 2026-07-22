import { cn } from '@/lib/utils';
import type { PulseUnit } from '@/lib/api';
import type { WidgetConfig } from '@/utils/dashboardWidgets';

const UNIT_OPTIONS: { value: PulseUnit; label: string }[] = [
  { value: 'hour', label: 'Hours' },
  { value: 'day', label: 'Days' },
  { value: 'week', label: 'Weeks' },
];

// The bucket unit (hour/day/week) the heatmap cells count over.
export default function PulseWidgetSettings({
  config,
  onConfigChange,
}: {
  config: WidgetConfig;
  onConfigChange: (config: WidgetConfig) => void;
}) {
  const unit = config.granularity ?? 'day';
  return (
    <div className="flex gap-1">
      {UNIT_OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onConfigChange({ granularity: o.value })}
          className={cn(
            'rounded-md px-2 py-0.5 text-xs transition-colors',
            unit === o.value
              ? 'bg-secondary font-medium text-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
