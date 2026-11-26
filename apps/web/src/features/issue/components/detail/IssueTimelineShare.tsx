import { durationLabel, type TimelineLane } from '../../utils/timeline';
import IssueTimelineItemsPopover from './IssueTimelineItemsPopover';

// One status as a section of the compact bar, sized by its share of the whole life of
// the issue. The bar is too thin for text, so the legend under it names the status and
// the hover title carries the figures. Clicking it opens every entry from that status,
// across all its stretches.

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
        aria-label={hoverTitle}
        className={`cursor-pointer opacity-90 hover:opacity-100 ${fixed ? 'w-6 shrink-0' : 'min-w-1'}`}
        style={{
          backgroundColor: lane.color,
          ...(fixed ? {} : { flexGrow: share, flexBasis: 0 }),
        }}
      />
    </IssueTimelineItemsPopover>
  );
}
