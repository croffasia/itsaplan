import { useTranslations } from 'next-intl';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
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
  const t = useTranslations('issue');
  const { isPending, isError, items } = useTimelineItemsQuery(issueId, ranges);

  if (isPending) return <ListSkeleton rows={3} rowClassName="h-8" />;
  if (isError) return <p className="text-sm text-muted-foreground">{t('activityLoadFailed')}</p>;
  if (items.length === 0)
    return <p className="text-sm text-muted-foreground">{t('noActivityInStretch')}</p>;
  return <ActivityItemList items={items} imageByUserId={imageByUserId} />;
}
