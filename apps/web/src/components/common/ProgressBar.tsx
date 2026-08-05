import { progressPercent } from '@/utils/progress';
import { cn } from '@/lib/utils';

// Issue progress as a thin bar plus a "completed/total" count. Canceled issues are
// excluded from the denominator so the bar reflects deliverable work. Shared by the
// groupings that track it: initiatives and cycles. The bar is a fixed width so it
// lines up down a list column; `wide` spreads it over whatever room it is given.
export default function ProgressBar({
  progress,
  wide,
}: {
  progress: { completed: number; canceled: number; total: number };
  wide?: boolean;
}) {
  return (
    <div className={cn('flex items-center gap-2', wide && 'w-full')}>
      <div className={cn('h-1.5 overflow-hidden rounded-full bg-muted', wide ? 'flex-1' : 'w-16')}>
        <div
          className="h-full rounded-full bg-foreground/70"
          style={{ width: `${progressPercent(progress)}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground tabular-nums">
        {progress.completed}/{progress.total - progress.canceled}
      </span>
    </div>
  );
}
