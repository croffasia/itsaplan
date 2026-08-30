import { Reply } from 'lucide-react';
import { type FeedItem } from '@/lib/api';
import Avatar from '@/components/common/Avatar';
import { Button } from '@/components/ui/button';
import { useRelativeTime } from '@/context/relativeTimeContext';
import IssueMarkdownEditor from '../editor/IssueMarkdownEditor';
import { useTranslations } from 'next-intl';

// One comment inside a thread card: a line of author, age and the reply button over
// the rendered markdown body. A feed entry stores the author's name, not their
// picture, so the uploaded avatar comes in as a prop (null falls back to the initials
// circle). The card and the indent of a reply belong to CommentThread.

export default function CommentItem({
  item,
  image,
  onReply,
}: {
  item: FeedItem;
  image: string | null;
  // Left out where replying is not offered: the shared read-only feed and the
  // timeline popover.
  onReply?: () => void;
}) {
  const t = useTranslations('issue.comments');
  const relativeTime = useRelativeTime();
  const author = item.actorName ?? t('unknownAuthor');

  return (
    // The id is the scroll target of the last-comment bubble.
    <div id={`feed-item-${item.id}`} className="group/comment">
      <div className="flex items-center gap-2">
        <Avatar name={author} image={image} className="size-5 shrink-0 text-[10px]" />
        <span className="truncate text-sm font-medium">{author}</span>
        <span className="shrink-0 text-xs text-muted-foreground">
          · {relativeTime(item.createdAt)}
        </span>
        {onReply && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onReply}
            className="ms-auto h-6 shrink-0 px-2 text-xs text-muted-foreground focus-visible:opacity-100 sm:opacity-0 sm:group-hover/comment:opacity-100"
          >
            <Reply className="size-3.5" />
            {t('reply')}
          </Button>
        )}
      </div>
      <IssueMarkdownEditor
        className="mt-1 ps-7 text-sm text-foreground/85"
        defaultValue={item.body ?? ''}
        editable={false}
      />
    </div>
  );
}
