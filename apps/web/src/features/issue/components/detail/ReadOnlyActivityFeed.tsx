import { formatDistanceToNow, parseISO } from 'date-fns';
import { CircleDot } from 'lucide-react';
import { type FeedItem } from '@/lib/api';
import Avatar from '@/components/common/Avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ACTION_ICON, describeActivity } from '../../utils/activityText';
import { mentionsToChips } from '../../utils/mentions';
import IssueMarkdownEditor from '../editor/IssueMarkdownEditor';

// The read-only timeline of a shared issue: comments and change events rendered
// from a fixed feed list (no composer, no pagination, no session). Mirrors the
// live IssueActivityFeed's item markup but takes the items as a prop.

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

export default function ReadOnlyActivityFeed({
  feed,
  imageByUserId,
}: {
  feed: FeedItem[];
  // Uploaded avatar per actor id (a feed entry stores the name, not the picture).
  imageByUserId: Map<string, string | null>;
}) {
  return (
    <div className="mt-6 border-t pt-5">
      <h3 className="mb-4 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Activity
      </h3>
      {feed.length === 0 ? (
        <p className="text-sm text-muted-foreground">No activity yet.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {feed.map((item) =>
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
      )}
    </div>
  );
}
