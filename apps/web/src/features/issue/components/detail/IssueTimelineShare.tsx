import { type TimelineLane } from '../../utils/timeline';
import { formatDuration } from '@/utils/dates';
import IssueTimelineItemsPopover from './IssueTimelineItemsPopover';

// One status as a section of the compact bar, sized by its share of the whole life of
// the issue. Clicking it opens every entry from that status, across all its stretches.

// Below this share of the bar a section is too narrow for its label; the legend and
// the hover title still carry the numbers.
const LABEL_MIN_PCT = 12;

export default function IssueTimelineShare({
  issueId,
  lane,
  share,
  imageByUserId,
}: {
  issueId: number;
  lane: TimelineLane;
  share: number;
  imageByUserId: Map<string, string | null>;
}) {
  const duration = formatDuration(lane.totalMs);
  const sharePct = Math.round(share);
  const visits = lane.bars.length;
  const subtitle =
    visits > 1 ? `${sharePct}% of the total · ${visits} stretches` : `${sharePct}% of the total`;
  // The bars are already in chronological order, so the merged entries are too.
  const ranges = lane.bars.map((bar) => ({ from: bar.segment.from, to: bar.segment.to }));

  return (
    <IssueTimelineItemsPopover
      issueId={issueId}
      title={lane.label}
      duration={duration}
      subtitle={subtitle}
      ranges={ranges}
      imageByUserId={imageByUserId}
    >
      <button
        type="button"
        title={`${lane.label} · ${duration} · ${sharePct}%`}
        className="flex min-w-1 cursor-pointer items-center justify-center overflow-hidden rounded-xs opacity-90 hover:opacity-100"
        style={{ width: `${share}%`, backgroundColor: lane.color }}
      >
        {share >= LABEL_MIN_PCT && (
          <span className="truncate px-1.5 text-[11px] font-medium text-white [text-shadow:0_1px_2px_rgb(0_0_0/0.35)]">
            {lane.label} · {duration}
          </span>
        )}
      </button>
    </IssueTimelineItemsPopover>
  );
}
