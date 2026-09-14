import Sparkline from '@/components/common/Sparkline';
import type { MindOverview } from '@/lib/api';

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div>
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight tabular-nums">{value}</p>
      {detail && <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}

export default function MindCoreStats({ overview }: { overview: MindOverview }) {
  const verifiedShare =
    overview.totalFacts > 0
      ? Math.round((overview.health.verified / overview.totalFacts) * 100)
      : 0;
  const values = overview.daily.map((day) => day.count);
  const peak = Math.max(...values, 0);

  return (
    <div className="flex h-full flex-col gap-4">
      <div>
        <p className="text-3xl font-semibold tracking-tight tabular-nums">{overview.totalFacts}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Facts remembered ·{' '}
          <span className="font-medium text-foreground">+{overview.factsThisWeek}</span> this week
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 border-t pt-4">
        <Stat label="Linked" value={String(overview.links)} detail="connections" />
        <Stat
          label="Verified"
          value={`${verifiedShare}%`}
          detail={`${overview.health.verified} facts`}
        />
      </div>

      <div className="mt-auto border-t pt-4">
        <div className="flex items-baseline justify-between">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Recalls · last {overview.daily.length} days
          </p>
          <span className="text-xs text-muted-foreground tabular-nums">peak {peak}/d</span>
        </div>
        <Sparkline
          values={values}
          label={`Recalls per day over the last ${overview.daily.length} days`}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground tabular-nums">{overview.recallsToday}</span>{' '}
          today
        </p>
      </div>
    </div>
  );
}
