import { durationLabel, type LifecycleMetrics, type TimelineLane } from '../../utils/timeline';
import IssueTimelineMetric from './IssueTimelineMetric';
import IssueTimelineShare from './IssueTimelineShare';
import { useTranslations } from 'next-intl';

// The whole life of the issue as one bar: a share per status, sized by the total time
// spent in it (repeat visits merged), with the same figures and the lifecycle metrics
// spread across the row under it, in the project's own order. A completed status is not
// scaled: it takes the width of its own name, and the rest split what is left.

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
  const t = useTranslations('issue.stats');
  const unfinished = lanes.filter((lane) => lane.stateType !== 'completed');
  // An issue that only ever sat in completed statuses leaves nothing else to scale,
  // so there they all take a share.
  const scaled = new Set(unfinished.length > 0 ? unfinished : lanes);
  const scaledMs = [...scaled].reduce((sum, lane) => sum + lane.totalMs, 0);
  const shareOf = (lane: TimelineLane) =>
    scaled.has(lane) && scaledMs > 0 ? (lane.totalMs / scaledMs) * 100 : 0;
  const ordered = [...lanes].sort((a, b) => a.order - b.order);
  const lead = durationLabel(metrics.leadMs);
  const cycle = durationLabel(metrics.cycleMs);

  return (
    <div>
      <div className="flex h-8 gap-0.5">
        {ordered.map((lane) => (
          <IssueTimelineShare
            key={lane.label}
            issueId={issueId}
            lane={lane}
            share={shareOf(lane)}
            fixed={!scaled.has(lane)}
            imageByUserId={imageByUserId}
          />
        ))}
      </div>

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-5 gap-y-2 text-xs text-muted-foreground">
        {ordered.map((lane) => {
          const duration = durationLabel(lane.totalMs);
          return (
            <div key={lane.label} className="flex items-center gap-1.5">
              <span
                className="size-2 shrink-0 rounded-xs"
                style={{ backgroundColor: lane.color }}
              />
              <span>{lane.label}</span>
              {duration && (
                <span className="font-medium text-foreground tabular-nums">{duration}</span>
              )}
            </div>
          );
        })}

        <div className="ml-auto flex items-center gap-4">
          {lead && (
            <IssueTimelineMetric
              label={t('leadTime')}
              value={lead}
              description="From creation to the first time the issue reached a completed status — the wait as seen from outside, queue included."
            />
          )}
          {cycle && (
            <IssueTimelineMetric
              label={t('cycleTime')}
              value={cycle}
              description="From the first started status to that same completion — the work itself, without the time spent waiting in the queue."
            />
          )}
        </div>
      </div>
    </div>
  );
}
