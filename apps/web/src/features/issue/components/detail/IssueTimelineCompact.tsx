import { type LifecycleMetrics, type TimelineLane } from '../../utils/timeline';
import { formatDuration } from '@/utils/dates';
import IssueTimelineMetric from './IssueTimelineMetric';
import IssueTimelineShare from './IssueTimelineShare';

// The whole life of the issue as one bar: a share per status, sized by the total time
// spent in it (repeat visits merged), with the same figures and the lifecycle metrics
// spread across the row under it.

export default function IssueTimelineCompact({
  issueId,
  lanes,
  metrics,
  imageByUserId,
}: {
  issueId: number;
  lanes: TimelineLane[];
  metrics: LifecycleMetrics;
  imageByUserId: Map<string, string | null>;
}) {
  const totalMs = lanes.reduce((sum, lane) => sum + lane.totalMs, 0);
  const shareOf = (lane: TimelineLane) => (totalMs > 0 ? (lane.totalMs / totalMs) * 100 : 0);

  return (
    <div>
      <div className="flex h-8 gap-0.5">
        {lanes.map((lane) => (
          <IssueTimelineShare
            key={lane.label}
            issueId={issueId}
            lane={lane}
            share={shareOf(lane)}
            imageByUserId={imageByUserId}
          />
        ))}
      </div>

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-5 gap-y-2 text-xs text-muted-foreground">
        {lanes.map((lane) => (
          <div key={lane.label} className="flex items-center gap-1.5">
            <span className="size-2 shrink-0 rounded-xs" style={{ backgroundColor: lane.color }} />
            <span>{lane.label}</span>
            <span className="font-medium text-foreground tabular-nums">
              {formatDuration(lane.totalMs)}
            </span>
          </div>
        ))}

        <div className="ml-auto flex items-center gap-4">
          {metrics.leadMs != null && (
            <IssueTimelineMetric
              label="Lead time"
              ms={metrics.leadMs}
              description="From creation to the first time the issue reached a completed status — the wait as seen from outside, queue included."
            />
          )}
          {metrics.cycleMs != null && (
            <IssueTimelineMetric
              label="Cycle time"
              ms={metrics.cycleMs}
              description="From the first started status to that same completion — the work itself, without the time spent waiting in the queue."
            />
          )}
        </div>
      </div>
    </div>
  );
}
