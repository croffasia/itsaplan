import { useTranslations } from 'next-intl';
import { type Column, type FeedGroup, type GroupedFeedPage } from '@/lib/api';
import ShowMoreButton from '@/components/common/ShowMoreButton';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import { useGroupedFeedQuery } from '../../services/comments.service';
import { statusColor } from '../../utils/timeline';
import IssueActivityGroup from './IssueActivityGroup';
import { type ComposerContext } from './CommentComposer';

// The activity log split by the status the issue was in when each entry was written,
// newest first and paged 25 at a time like the flat one. The server does the
// splitting; this only joins a stretch whose entries fell into two pages.

export default function IssueGroupedFeed({
  issueId,
  columns,
  imageByUserId,
  composer,
}: {
  issueId: number;
  // The project's columns, for the status colors.
  columns: Column[];
  imageByUserId: Map<string, string | null>;
  composer: ComposerContext;
}) {
  const t = useTranslations('issue');
  const feedQuery = useGroupedFeedQuery(issueId);
  const groups = joinGroups(feedQuery.data?.pages ?? []);

  if (feedQuery.isLoading) return <ListSkeleton rows={3} rowClassName="h-12" />;

  if (groups.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('noActivity')}</p>;
  }

  return (
    <>
      <ol className="flex flex-col gap-5">
        {groups.map((group) => (
          <IssueActivityGroup
            key={group.from}
            group={group}
            color={statusColor(columns, group.status)}
            imageByUserId={imageByUserId}
            composer={composer}
          />
        ))}
      </ol>
      {feedQuery.hasNextPage && (
        <ShowMoreButton
          loading={feedQuery.isFetchingNextPage}
          onClick={() => void feedQuery.fetchNextPage()}
        />
      )}
    </>
  );
}

// The stretch a page ends in continues at the top of the next one, so groups are
// joined by their start. Entries are deduped by id for the same reason IssueFeedList
// does it: a boundary entry can shift between pages after a refetch.
function joinGroups(pages: GroupedFeedPage[]): FeedGroup[] {
  const byStart = new Map<string, FeedGroup>();
  const seen = new Set<number>();
  const groups: FeedGroup[] = [];
  for (const group of pages.flatMap((page) => page.groups)) {
    let joined = byStart.get(group.from);
    if (!joined) {
      joined = { ...group, items: [] };
      byStart.set(group.from, joined);
      groups.push(joined);
    }
    for (const item of group.items) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      joined.items.push(item);
    }
  }
  return groups;
}
