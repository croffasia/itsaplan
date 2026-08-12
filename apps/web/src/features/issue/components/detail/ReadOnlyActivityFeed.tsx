import { type FeedItem } from '@/lib/api';
import ActivityItemList from './ActivityItemList';
import { useTranslations } from 'next-intl';

// The read-only timeline of a shared issue: comments and change events rendered
// from a fixed feed list (no composer, no pagination, no session).

export default function ReadOnlyActivityFeed({
  feed,
  imageByUserId,
}: {
  feed: FeedItem[];
  // Uploaded avatar per actor id (a feed entry stores the name, not the picture).
  imageByUserId: Map<string, string | null>;
}) {
  const t = useTranslations('issue');
  return (
    <div className="mt-6 border-t pt-5">
      <h3 className="mb-4 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {t('activityHeading')}
      </h3>
      {feed.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('noActivity')}</p>
      ) : (
        <ActivityItemList items={feed} imageByUserId={imageByUserId} />
      )}
    </div>
  );
}
