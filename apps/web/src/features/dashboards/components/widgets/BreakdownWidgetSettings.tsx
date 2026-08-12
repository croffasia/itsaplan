import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { WidgetConfig } from '@/utils/dashboardWidgets';
import { BY_OPTIONS } from './BreakdownWidget';

// The dimension the counts are grouped by.
export default function BreakdownWidgetSettings({
  config,
  onConfigChange,
}: {
  config: WidgetConfig;
  onConfigChange: (config: WidgetConfig) => void;
}) {
  const t = useTranslations('dashboards.breakdown');
  const by = config.by ?? 'status';
  return (
    <div className="flex flex-wrap gap-1">
      {BY_OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onConfigChange({ by: option })}
          className={cn(
            'rounded-md px-2 py-0.5 text-xs transition-colors',
            by === option
              ? 'bg-secondary font-medium text-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground',
          )}
        >
          {t(`by.${option}`)}
        </button>
      ))}
    </div>
  );
}
