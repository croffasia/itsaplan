'use client';

import { useInitiativeFeedQuery } from '@/services/initiatives.service';
import { Button } from '@/components/ui/button';
import InitiativeFeedRow from './InitiativeFeedRow';

// The initiative's activity: its own events plus its linked issues' activity, one
// feed paged newest first.
export default function InitiativeActivityFeed({
  initiativeId,
  projectKey,
}: {
  initiativeId: number;
  projectKey: string;
}) {
  const feed = useInitiativeFeedQuery(initiativeId);

  // Pages can overlap when new activity shifts the offset, so drop repeated ids.
  const byId = new Map((feed.data?.pages ?? []).flatMap((p) => p.items).map((it) => [it.id, it]));
  const items = [...byId.values()];

  if (items.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        {feed.isLoading ? 'Loading…' : 'No activity yet.'}
      </p>
    );

  return (
    <>
      <ul className="flex flex-col gap-2.5">
        {items.map((item) => (
          <InitiativeFeedRow key={item.id} item={item} projectKey={projectKey} />
        ))}
      </ul>
      {feed.hasNextPage && (
        <div className="mt-4">
          <Button
            variant="ghost"
            size="sm"
            disabled={feed.isFetchingNextPage}
            onClick={() => void feed.fetchNextPage()}
          >
            {feed.isFetchingNextPage ? 'Loading…' : 'Show more'}
          </Button>
        </div>
      )}
    </>
  );
}
