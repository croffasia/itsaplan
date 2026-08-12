import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { PulseUnit } from '@/lib/api';
import type { WidgetConfig } from '@/utils/dashboardWidgets';

const UNIT_OPTIONS: PulseUnit[] = ['hour', 'day', 'week'];

// The bucket unit (hour/day/week) the heatmap cells count over.
export default function PulseWidgetSettings({
  config,
  onConfigChange,
}: {
  config: WidgetConfig;
  onConfigChange: (config: WidgetConfig) => void;
}) {
  const t = useTranslations('dashboards.pulse');
  const unit = config.granularity ?? 'day';
  return (
    <div className="flex gap-1">
      {UNIT_OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onConfigChange({ granularity: option })}
          className={cn(
            'rounded-md px-2 py-0.5 text-xs transition-colors',
            unit === option
              ? 'bg-secondary font-medium text-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground',
          )}
        >
          {t(`unit.${option}`)}
        </button>
      ))}
    </div>
  );
}
