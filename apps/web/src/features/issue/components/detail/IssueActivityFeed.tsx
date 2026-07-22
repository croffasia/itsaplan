import { formatDistanceToNow, parseISO } from 'date-fns';
import { CircleDot } from 'lucide-react';
import { type Assignee, type FeedItem } from '@/lib/api';
import { useSession } from '@/lib/auth-client';
import { useFeedQuery } from '../../services/comments.service';
import { ACTION_ICON, describeActivity } from '../../utils/activityText';
import { mentionsToChips } from '../../utils/mentions';
import Avatar from '@/components/common/Avatar';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import IssueMarkdownEditor from '../editor/IssueMarkdownEditor';
import CommentComposer from './CommentComposer';

// The issue's timeline: comments and change events, one feed (kanban_issue_feed)
// paged from the backend newest first, with a comment composer at the top. "Show
// more" loads the next 25-item page. The composer posts as the current session
// user. The feed query refetches on its own when a issue edit invalidates it (see
// useUpdateIssue / useSetFieldValue), so it reflects edits without the parent
// signaling it.

function ActivityLine({ item }: { item: FeedItem }) {
  const Icon = (item.action && ACTION_ICON[item.action]) || CircleDot;
  const { line, popover } = describeActivity(item);
  const actor = item.actorName ?? 'System';
  return (
    <li className="flex items-center gap-2.5 text-xs">
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-3" />
      </span>
      <span className="min-w-0 text-muted-foreground">
        <span className="font-medium text-muted-foreground">{actor}</span> {line}
        {popover && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="ml-1.5 text-foreground/70 underline underline-offset-2 hover:text-foreground"
              >
                view
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="max-h-80 w-96 overflow-y-auto">
              <IssueMarkdownEditor className="text-sm" defaultValue={popover} editable={false} />
            </PopoverContent>
          </Popover>
        )}
        <span className="ml-1.5 text-xs">
          · {formatDistanceToNow(parseISO(item.createdAt), { addSuffix: true })}
        </span>
      </span>
    </li>
  );
}

function CommentItem({ item, image }: { item: FeedItem; image: string | null }) {
  const author = item.actorName ?? 'Unknown';
  return (
    <li className="flex gap-3">
      <Avatar name={author} image={image} className="mt-0.5 size-7 text-[11px]" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium">{author}</span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(parseISO(item.createdAt), { addSuffix: true })}
          </span>
        </div>
        <IssueMarkdownEditor
          className="text-sm text-foreground/85"
          defaultValue={mentionsToChips(item.body ?? '')}
          editable={false}
        />
      </div>
    </li>
  );
}

export default function IssueActivityFeed({
  issueId,
  assignees,
}: {
  issueId: number;
  assignees: Assignee[];
}) {
  const feedQuery = useFeedQuery(issueId);
  const { data: session } = useSession();

  const user = session?.user ?? null;
  const authorName = user?.name || user?.email || 'You';
  const authorImage = (user as { image?: string | null } | null)?.image ?? null;

  // The pages come back newest first. Dedupe by id so a boundary item that shifts
  // between pages after a refetch (an edit adds new entries at the top) never
  // renders with a duplicate key. The first copy wins: it comes from the newer
  // page, so an edited comment keeps its latest body.
  const byId = new Map<number, FeedItem>();
  for (const item of (feedQuery.data?.pages ?? []).flatMap((p) => p.items)) {
    if (!byId.has(item.id)) byId.set(item.id, item);
  }
  const items = [...byId.values()];

  // A feed entry stores the author's name, not their picture, so the uploaded
  // avatar comes from the project's candidate list by actor id. An author who is
  // no longer a member falls back to the initials circle.
  const imageByUserId = new Map(assignees.map((a) => [a.userId, a.image]));

  return (
    <div className="mt-6 border-t pt-5">
      <h3 className="mb-4 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Activity
      </h3>

      <CommentComposer
        issueId={issueId}
        assignees={assignees}
        authorName={authorName}
        authorImage={authorImage}
      />

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {feedQuery.isLoading ? 'Loading…' : 'No activity yet.'}
        </p>
      ) : (
        <>
          <ul className="flex flex-col gap-2.5">
            {items.map((item) =>
              item.kind === 'comment' ? (
                <CommentItem
                  key={item.id}
                  item={item}
                  image={(item.actorUserId && imageByUserId.get(item.actorUserId)) ?? null}
                />
              ) : (
                <ActivityLine key={item.id} item={item} />
              ),
            )}
          </ul>
          {feedQuery.hasNextPage && (
            <div className="mt-4">
              <Button
                variant="ghost"
                size="sm"
                disabled={feedQuery.isFetchingNextPage}
                onClick={() => void feedQuery.fetchNextPage()}
              >
                {feedQuery.isFetchingNextPage ? 'Loading…' : 'Show more'}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
