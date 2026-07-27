import { durationLabel, type TimelineLane } from '../../utils/timeline';
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
  fixed,
  imageByUserId,
}: {
  issueId: number;
  lane: TimelineLane;
  share: number;
  // Sized by its label instead of by its share, and left out of the figures the others
  // are measured against.
  fixed: boolean;
  imageByUserId: Map<string, string | null>;
}) {
  const duration = durationLabel(lane.totalMs);
  const sharePct = Math.round(share);
  const visits = lane.bars.length;
  const subtitle = [
    fixed ? '' : `${sharePct}% of the total`,
    visits > 1 ? `${visits} stretches` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  const label = [lane.label, fixed ? '' : duration].filter(Boolean).join(' · ');
  const hoverTitle = [lane.label, duration, fixed ? '' : `${sharePct}%`]
    .filter(Boolean)
    .join(' · ');
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
        title={hoverTitle}
        className={`flex cursor-pointer items-center justify-center overflow-hidden rounded-xs opacity-90 hover:opacity-100 ${fixed ? 'shrink-0' : 'min-w-1'}`}
        style={{
          backgroundColor: lane.color,
          ...(fixed ? {} : { flexGrow: share, flexBasis: 0 }),
        }}
      >
        {(fixed || share >= LABEL_MIN_PCT) && (
          <span
            className={`px-1.5 text-[11px] font-medium text-white [text-shadow:0_1px_2px_rgb(0_0_0/0.35)] ${fixed ? 'whitespace-nowrap' : 'truncate'}`}
          >
            {label}
          </span>
        )}
      </button>
    </IssueTimelineItemsPopover>
  );
}
