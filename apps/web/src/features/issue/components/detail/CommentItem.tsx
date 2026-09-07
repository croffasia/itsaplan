import { useState } from 'react';
import { Pencil, Reply, Trash2 } from 'lucide-react';
import { type FeedItem } from '@/lib/api';
import Avatar from '@/components/common/Avatar';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { useRelativeTime } from '@/context/relativeTimeContext';
import IssueMarkdownEditor from '../editor/IssueMarkdownEditor';
import CommentEditBox from './CommentEditBox';
import { useDeleteComment } from '../../services/comments.service';
import { useTranslations } from 'next-intl';

// One comment inside a thread card: a line of author, age and the reply button over
// the rendered markdown body. A feed entry stores the author's name, not their
// picture, so the uploaded avatar comes in as a prop (null falls back to the initials
// circle). The card and the indent of a reply belong to CommentThread.

export default function CommentItem({
  item,
  image,
  onReply,
  canEdit,
  canDelete,
}: {
  item: FeedItem;
  image: string | null;
  // Left out where replying is not offered: the shared read-only feed and the
  // timeline popover.
  onReply?: () => void;
  // Set by CommentThread only where the current user may change this comment: the
  // author with work_items edit, or a project owner. The API asserts the same.
  canEdit?: boolean;
  canDelete?: boolean;
}) {
  const t = useTranslations('issue.comments');
  const deleteComment = useDeleteComment();
  const relativeTime = useRelativeTime();
  const author = item.actorName ?? t('unknownAuthor');
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    // The id is the scroll target of the last-comment bubble.
    <div id={`feed-item-${item.id}`} className="group/comment">
      <div className="flex items-center gap-2">
        <Avatar name={author} image={image} className="size-5 shrink-0 text-[10px]" />
        <span className="truncate text-sm font-medium">{author}</span>
        <span className="shrink-0 text-xs text-muted-foreground">
          · {relativeTime(item.createdAt)}
        </span>
        {(onReply || canEdit || canDelete) && (
          <div className="ms-auto flex shrink-0 items-center gap-0.5 focus-within:opacity-100 sm:opacity-0 sm:group-hover/comment:opacity-100">
            {canEdit && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditing(true)}
                className="h-6 px-2 text-xs text-muted-foreground"
                title={t('edit')}
              >
                <Pencil className="size-3.5" />
              </Button>
            )}
            {canDelete && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setConfirmingDelete(true)}
                className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
                title={t('deleteComment')}
              >
                <Trash2 className="size-3.5" />
              </Button>
            )}
            {onReply && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onReply}
                className="h-6 px-2 text-xs text-muted-foreground"
              >
                <Reply className="size-3.5" />
                {t('reply')}
              </Button>
            )}
          </div>
        )}
      </div>
      {editing ? (
        <CommentEditBox
          issueId={item.issueId}
          commentId={item.id}
          initialBody={item.body ?? ''}
          onClose={() => setEditing(false)}
        />
      ) : (
        <IssueMarkdownEditor
          className="mt-1 ps-7 text-sm text-foreground/85"
          defaultValue={item.body ?? ''}
          editable={false}
        />
      )}

      {confirmingDelete && (
        <ConfirmDialog
          title={t('deleteCommentTitle')}
          confirmLabel={t('deleteComment')}
          onConfirm={async () => {
            await deleteComment.mutateAsync({ issueId: item.issueId, commentId: item.id });
            setConfirmingDelete(false);
          }}
          onClose={() => setConfirmingDelete(false)}
        >
          <p className="text-sm text-muted-foreground">{t('deleteCommentConfirmation')}</p>
        </ConfirmDialog>
      )}
    </div>
  );
}
