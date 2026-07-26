import { type TimelineLane } from '../../utils/timeline';
import { formatDuration } from '@/utils/dates';
import IssueTimelineBar from './IssueTimelineBar';

// One status of the issue's history: its name and total time on the left, its
// stretches placed on the shared time axis on the right. Below the container's
// narrow breakpoint the label moves above the track so the axis keeps its width.

export default function IssueTimelineLane({
  issueId,
  lane,
  imageByUserId,
}: {
  issueId: number;
  lane: TimelineLane;
  imageByUserId: Map<string, string | null>;
}) {
  return (
    <div className="flex flex-col gap-0.5 @md:flex-row @md:items-center @md:gap-3">
      <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground @md:w-28 @md:shrink-0 @md:justify-end">
        <span className="size-2 shrink-0 rounded-xs" style={{ backgroundColor: lane.color }} />
        <span className="truncate">{lane.label}</span>
      </div>
      <div className="relative h-5 flex-1 rounded-sm bg-muted/60">
        {lane.bars.map((bar) => (
          <IssueTimelineBar
            key={bar.segment.from}
            issueId={issueId}
            bar={bar}
            color={lane.color}
            status={lane.label}
            imageByUserId={imageByUserId}
          />
        ))}
      </div>
      <span className="text-xs text-muted-foreground tabular-nums @md:w-10 @md:shrink-0">
        {formatDuration(lane.totalMs)}
      </span>
    </div>
  );
}
