import { durationLabel, type TimelineBar } from '../../utils/timeline';
import { formatDateTime } from '@/utils/dates';
import IssueTimelineItemsPopover from './IssueTimelineItemsPopover';

// One stretch in a status lane, placed on the shared time axis. Clicking it opens
// the entries recorded while the issue sat in that status. A very short stretch
// would collapse to nothing, so the bar keeps a minimum width.

export default function IssueTimelineBar({
  issueId,
  bar,
  color,
  status,
  imageByUserId,
}: {
  issueId: number;
  bar: TimelineBar;
  color: string;
  status: string;
  imageByUserId: Map<string, string | null>;
}) {
  const { segment, fixed } = bar;
  const duration = durationLabel(segment.durationMs);
  const span = `${formatDateTime(segment.from)} → ${segment.to ? formatDateTime(segment.to) : 'now'}`;
  return (
    <IssueTimelineItemsPopover
      issueId={issueId}
      title={status}
      duration={duration}
      subtitle={span}
      ranges={[{ from: segment.from, to: segment.to }]}
      imageByUserId={imageByUserId}
    >
      {/* The fixed bar sits past the end of the axis; its margin and width add up to
          the room IssueTimelineLane leaves after the track (mr-12). */}
      <button
        type="button"
        title={[status, duration, span].filter(Boolean).join(' · ')}
        className={`absolute top-0.5 bottom-0.5 min-w-1 cursor-pointer rounded-xs opacity-90 hover:opacity-100 ${fixed ? 'ml-1 w-11' : ''}`}
        style={{
          left: `${bar.leftPct}%`,
          width: fixed ? undefined : `${bar.widthPct}%`,
          backgroundColor: color,
        }}
      />
    </IssueTimelineItemsPopover>
  );
}
