import { formatDistanceToNow, parseISO } from 'date-fns';
import { type FeedItem } from '@/lib/api';
import Avatar from '@/components/common/Avatar';
import { mentionsToChips } from '../../utils/mentions';
import IssueMarkdownEditor from '../editor/IssueMarkdownEditor';

// One comment in an activity list: avatar, author, age, and the rendered markdown
// body. A feed entry stores the author's name, not their picture, so the uploaded
// avatar comes in as a prop (null falls back to the initials circle). Used by the
// live feed, the shared read-only feed, and the timeline's per-status popover.

export default function CommentItem({ item, image }: { item: FeedItem; image: string | null }) {
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
