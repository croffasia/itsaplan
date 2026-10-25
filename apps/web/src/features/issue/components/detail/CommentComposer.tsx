import { useEffect, useState } from 'react';
import Avatar from '@/components/common/Avatar';
import MentionMenu from '@/components/common/inputs/MentionMenu';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useMentionCandidates } from '@/hooks/useMentionCandidates';
import { useMentionMenu } from '@/hooks/useMentionMenu';
import { useCreateComment, useUpdateComment } from '../../services/comments.service';
import { useTranslations } from 'next-intl';

// The comment box, for a new comment or for editing one: a plain markdown textarea
// with an @-mention menu (useMentionMenu). The feed renders a handle in the body as a
// chip. Posts or saves as the current session user on the button or Cmd/Ctrl+Enter.

// What every composer needs to post, gathered once by the activity feed: the issue,
// the project its "@" menu reads, and the author the avatar stands for.
export interface ComposerContext {
  issueId: number;
  projectKey: string;
  authorName: string;
  authorImage: string | null;
}

export default function CommentComposer({
  issueId,
  projectKey,
  authorName,
  authorImage,
  replyToId,
  replyToName,
  onClose,
  commentId,
  initialBody,
}: ComposerContext & {
  // Set on the reply box a thread opens: the comment it answers and its author.
  replyToId?: number;
  replyToName?: string | null;
  // Closes the box — on the cancel button, on Escape, and once the comment is
  // posted or saved. The boxes a thread opens (reply, edit) are the only ones that
  // can be closed.
  onClose?: () => void;
  // Set when the box edits an existing comment instead of posting a new one.
  commentId?: number;
  initialBody?: string;
}) {
  const t = useTranslations('issue.comments');
  const tCommon = useTranslations('common');
  const createComment = useCreateComment();
  const updateComment = useUpdateComment();
  const [body, setBody] = useState(initialBody ?? '');
  const [focused, setFocused] = useState(false);
  const candidates = useMentionCandidates({ projectKey, on: 'issue', place: 'comment' });
  const mention = useMentionMenu(body, setBody, candidates);

  const isReply = replyToId != null;
  const isEdit = commentId != null;
  const posting = (isEdit ? updateComment : createComment).isPending;
  const cmdKey = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform) ? '⌘' : 'Ctrl';

  // A reply box or an edit box is opened by a deliberate click, so it takes the
  // caret — at the end of the text being edited.
  useEffect(() => {
    const ta = mention.ref.current;
    if (!ta || (!isReply && !isEdit)) return;
    ta.focus();
    if (isEdit) ta.setSelectionRange(ta.value.length, ta.value.length);
  }, [isReply, isEdit, mention.ref]);

  async function post() {
    const next = body.trim();
    if (!next) return;
    if (isEdit) {
      if (next === initialBody?.trim()) return onClose?.();
      await updateComment.mutateAsync({ issueId, commentId: commentId!, body: next });
    } else {
      await createComment.mutateAsync({ issueId, input: { body: next, replyToId } });
      setBody('');
    }
    mention.close();
    onClose?.();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mention.onKeyDown(e)) return;
    if (e.key === 'Escape' && onClose) {
      e.preventDefault();
      onClose();
      return;
    }
    // Cmd/Ctrl+Enter submits, matching the rest of the planner.
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void post();
  }

  let placeholder = t('placeholder');
  if (isReply)
    placeholder = replyToName ? t('replyTo', { name: replyToName }) : t('replyPlaceholder');

  let submitLabel = isReply ? t('reply') : t('comment');
  if (isEdit) submitLabel = tCommon('save');
  if (posting) submitLabel = isEdit ? tCommon('saving') : t('posting');

  // The reply and edit boxes open inside a thread, so they render compact and
  // without the bottom gap the standalone composer keeps.
  const compact = isReply || isEdit;
  // The standalone box stays one line until it is used, so it weighs no more than
  // the feed under it; it grows its footer once focused or holding a draft.
  const expanded = compact || focused || body.length > 0;

  return (
    <div className={cn(!compact && 'mb-5')}>
      <div className="flex gap-3">
        <Avatar
          name={authorName}
          image={authorImage}
          className={cn('shrink-0 text-[11px]', compact ? 'mt-0.5 size-6' : 'mt-1.5 size-7')}
          title={t('commentAs', { name: authorName })}
        />
        <div className="relative min-w-0 flex-1">
          <div className="overflow-hidden rounded-lg border bg-muted/20 shadow-xs transition-[border-color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/30">
            <Textarea
              ref={mention.ref}
              // `auto` once there is something to read, so a comment keeps the
              // script it was typed in. An empty box has nothing to read from, and
              // would fall back to left-to-right and strand the placeholder.
              dir={body ? 'auto' : undefined}
              value={body}
              onChange={mention.onChange}
              onFocus={() => setFocused(true)}
              onBlur={() => {
                mention.close();
                setFocused(false);
              }}
              placeholder={placeholder}
              className={cn(
                'resize-none rounded-none border-0 bg-transparent px-3 py-2.5 shadow-none focus-visible:ring-0',
                !expanded ? 'min-h-10' : compact ? 'min-h-[52px]' : 'min-h-[64px]',
              )}
              onKeyDown={onKeyDown}
            />
            {expanded && (
              <div className="flex items-center justify-between gap-2 border-t px-2.5 py-2">
                {isEdit ? (
                  <span />
                ) : (
                  <span className="text-[11px] text-muted-foreground/70">
                    <kbd className="rounded bg-muted px-1.5 py-0.5 font-sans text-[10px] font-medium">
                      {cmdKey} ↵
                    </kbd>
                    <span className="ml-1.5">{t('toSend')}</span>
                  </span>
                )}
                <div className="flex items-center gap-1.5">
                  {onClose && (
                    <Button size="sm" variant="ghost" onClick={onClose}>
                      {t('cancel')}
                    </Button>
                  )}
                  <Button size="sm" disabled={!body.trim() || posting} onClick={() => void post()}>
                    {submitLabel}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <MentionMenu
            ref={mention.menuRef}
            items={mention.matches}
            onPick={mention.pick}
            className="absolute inset-x-0 top-full z-20 mt-1 w-auto"
          />
        </div>
      </div>
    </div>
  );
}
