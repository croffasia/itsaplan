import { useTimelineItemsQuery, type TimelineRange } from '../../services/comments.service';
import ActivityItemList from './ActivityItemList';

// The body of a timeline popover: the feed entries of the stretches behind what was
// clicked. It renders only while the popover is open, so the entries are read on the
// click — the timeline itself carries durations, not activity.

export default function IssueTimelineItems({
  issueId,
  ranges,
  imageByUserId,
}: {
  issueId: number;
  // One range per stretch: a bar opens one, a status with repeat visits opens all
  // of its own.
  ranges: TimelineRange[];
  imageByUserId: Map<string, string | null>;
}) {
  const { isPending, isError, items } = useTimelineItemsQuery(issueId, ranges);

  if (isPending) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (isError) return <p className="text-sm text-muted-foreground">Could not load the activity.</p>;
  if (items.length === 0)
    return <p className="text-sm text-muted-foreground">No activity in this stretch.</p>;
  return <ActivityItemList items={items} imageByUserId={imageByUserId} />;
}
