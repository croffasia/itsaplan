import { useTranslations } from 'next-intl';
import type { BurnupForecast } from '@/lib/api';
import type { WidgetConfig } from '@/utils/dashboardWidgets';
import { formatDate } from '@/utils/dates';
import { Skeleton } from '@/components/ui/skeleton';
import type { ChartConfig } from '@/components/ui/chart';
import { useBurnupQuery } from '../../services/analytics.service';
import { buildBurnupPoints } from '../../utils/burnupSeries';
import BurnupChart from './BurnupChart';

const SERIES_COLOR = {
  scope: '#94a3b8',
  started: '#f59e0b',
  completed: '#22c55e',
  projection: '#16a34a',
};

// Scope, started and completed issues at the end of each day, with a completion
// date projected from the recent closing rate — the project graph of Linear. The
// window, the initiative and the forecast window are configured settings (see
// BurnupWidgetSettings), not live controls.
export default function BurnupWidget({
  projectKey,
  config,
}: {
  projectKey: string;
  config: WidgetConfig;
}) {
  const t = useTranslations('dashboards.burnup');
  const tDashboards = useTranslations('dashboards');
  const days = config.days ?? 90;
  const forecastWeeks = config.forecastWeeks ?? 4;
  const initiativeId = config.initiativeId ?? null;
  const { data, isLoading } = useBurnupQuery(projectKey, { days, initiativeId, forecastWeeks });

  const chartConfig: ChartConfig = {
    scope: { label: t('scope'), color: SERIES_COLOR.scope },
    started: { label: t('started'), color: SERIES_COLOR.started },
    completed: { label: t('completed'), color: SERIES_COLOR.completed },
    projection: { label: t('projection'), color: SERIES_COLOR.projection },
  };

  function caption(forecast: BurnupForecast, targetDate: string | null): string {
    const parts: string[] = [];
    if (forecast.remaining === 0) parts.push(t('allDone'));
    else if (forecast.projectedDate == null) parts.push(t('noForecast', { weeks: forecastWeeks }));
    else {
      parts.push(
        t('projected', { date: formatDate(forecast.projectedDate) }),
        t('velocity', { rate: forecast.velocityPerDay }),
        t('remaining', { count: forecast.remaining }),
      );
    }
    if (targetDate) parts.push(t('target', { date: formatDate(targetDate) }));
    return parts.join(' · ');
  }

  function body() {
    if (isLoading) return <Skeleton className="h-[180px] w-full" />;
    const today = data?.days.at(-1);
    if (!data || !today || data.days.every((d) => d.scope === 0)) {
      return <p className="py-10 text-center text-sm text-muted-foreground">{t('empty')}</p>;
    }
    return (
      <>
        <BurnupChart
          points={buildBurnupPoints(data)}
          config={chartConfig}
          today={today.date}
          target={data.targetDate}
        />
        <p className="text-xs text-muted-foreground">{caption(data.forecast, data.targetDate)}</p>
      </>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{tDashboards('lastDays', { days })}</p>
      {body()}
    </div>
  );
}
