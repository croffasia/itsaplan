import { useState } from 'react';
import { Link2, Pencil, Reply, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { FeedItem } from '@/lib/api/endpoints/activity';
import Avatar from '@/components/common/Avatar';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';
import MarkdownEditor from '@/components/common/editor/MarkdownEditor';
import { Button } from '@/components/ui/button';
import { useRelativeTime } from '@/context/relativeTimeContext';
import { commentPath } from '@/utils/paths';
import CommentComposer, { type ComposerContext } from './CommentComposer';
import { useCommentLink } from '../../context/commentLink';
import { useDeleteComment } from '../../services/comments.service';
import { writeClipboardText } from '../../utils/clipboard';
import { useTranslations } from 'next-intl';

// One comment inside a thread: a line of author, age and its actions over the
// rendered markdown body. A feed entry stores the author's name, not their picture,
// so the uploaded avatar comes in as a prop (null falls back to the initials circle).
// The indent of a reply belongs to CommentThread.

export default function CommentItem({
  item,
  image,
  onReply,
  canEdit,
  canDelete,
  composer,
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
  // The feed's composer state; the edit box posts with the same @-mention menu.
  composer?: ComposerContext;
}) {
  const t = useTranslations('issue.comments');
  const tMenu = useTranslations('issue.menu');
  const deleteComment = useDeleteComment();
  const link = useCommentLink();
  const relativeTime = useRelativeTime();
  const author = item.actorName ?? t('unknownAuthor');
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function copyLink(projectKey: string, sequenceNumber: number) {
    try {
      await writeClipboardText(
        `${window.location.origin}${commentPath(projectKey, sequenceNumber, item.id)}`,
      );
      toast.success(t('linkCopied'));
    } catch {
      toast.error(tMenu('copyFailed'));
    }
  }

  return (
    // The id is the scroll target of the last-comment bubble and of a comment link.
    <div id={`feed-item-${item.id}`} className="group/comment relative scroll-mt-20">
      {link?.highlightedId === item.id && (
        <span
          aria-hidden
          className="pointer-events-none absolute -inset-x-2 -inset-y-1.5 animate-out rounded-lg bg-primary/10 delay-1000 duration-1000 fill-mode-forwards fade-out motion-reduce:animate-none"
        />
      )}
      <div className="flex items-center gap-2.5">
        <Avatar name={author} image={image} className="size-6 shrink-0 text-[10px]" />
        <span className="truncate text-[13px] font-semibold">{author}</span>
        <span className="shrink-0 text-xs text-muted-foreground">
          · {relativeTime(item.createdAt)}
          {item.editedAt && ` · ${t('edited')}`}
        </span>
        {(onReply || canEdit || canDelete) && (
          <div className="ms-auto flex shrink-0 items-center gap-0.5 focus-within:opacity-100 sm:opacity-0 sm:group-hover/comment:opacity-100">
            {link && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void copyLink(link.projectKey, link.sequenceNumber)}
                className="h-6 px-2 text-xs text-muted-foreground"
                title={t('copyLink')}
              >
                <Link2 className="size-3.5" />
              </Button>
            )}
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
      {editing && composer ? (
        <div className="mt-1 ps-8.5">
          <CommentComposer
            {...composer}
            commentId={item.id}
            initialBody={item.body ?? ''}
            onClose={() => setEditing(false)}
          />
        </div>
      ) : (
        <div className="mt-1 ps-8.5">
          <div className="w-fit max-w-full rounded-xl rounded-ss-sm bg-muted/60 px-3 py-2">
            <MarkdownEditor
              className="text-sm text-foreground/90 [&_a.issue-ref]:mx-1 [&_a.issue-ref]:text-[0.9em]"
              defaultValue={item.body ?? ''}
              editable={false}
            />
          </div>
        </div>
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
