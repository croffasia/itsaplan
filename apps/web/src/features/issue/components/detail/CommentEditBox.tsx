import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useUpdateComment } from '../../services/comments.service';
import { useTranslations } from 'next-intl';

// The inline box a comment opens for editing: the markdown body in a plain
// textarea, saved on the button or Cmd/Ctrl+Enter, closed on cancel or Escape.

export default function CommentEditBox({
  issueId,
  commentId,
  initialBody,
  onClose,
}: {
  issueId: number;
  commentId: number;
  initialBody: string;
  onClose: () => void;
}) {
  const t = useTranslations('issue.comments');
  const tCommon = useTranslations('common');
  const updateComment = useUpdateComment();
  const [body, setBody] = useState(initialBody);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const ta = taRef.current;
    ta?.focus();
    ta?.setSelectionRange(ta.value.length, ta.value.length);
  }, []);

  async function save() {
    const next = body.trim();
    if (!next || next === initialBody) return onClose();
    await updateComment.mutateAsync({ issueId, commentId, body: next });
    onClose();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void save();
  }

  return (
    <div className="mt-1 overflow-hidden rounded-lg border bg-muted/20 shadow-xs transition-[border-color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/30">
      <Textarea
        ref={taRef}
        dir={body ? 'auto' : undefined}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className="min-h-[52px] resize-none rounded-none border-0 bg-transparent px-3 py-2.5 text-sm shadow-none focus-visible:ring-0"
        onKeyDown={onKeyDown}
      />
      <div className="flex justify-end gap-1.5 border-t px-2.5 py-2">
        <Button size="sm" variant="ghost" onClick={onClose}>
          {t('cancel')}
        </Button>
        <Button
          size="sm"
          disabled={!body.trim() || updateComment.isPending}
          onClick={() => void save()}
        >
          {updateComment.isPending ? t('saving') : tCommon('save')}
        </Button>
      </div>
    </div>
  );
}
