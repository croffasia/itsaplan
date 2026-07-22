import type { InitiativeProgress } from '@/lib/api';

// Issue progress as a thin bar plus a "completed/total" count. Canceled issues are
// excluded from the denominator so the bar reflects deliverable work.
export default function ProgressBar({ progress }: { progress: InitiativeProgress }) {
  const denom = progress.total - progress.canceled;
  const pct = denom > 0 ? Math.round((progress.completed / denom) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-foreground/70" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground tabular-nums">
        {progress.completed}/{denom}
      </span>
    </div>
  );
}
