import { useEffect, useRef, useState } from 'react';
import { readCommentDraft, writeCommentDraft, type CommentDraftBox } from '@/utils/commentDrafts';

// The text of a comment box, saved as a draft on every change. A box left empty, or
// holding the unchanged text of the comment being edited, keeps no draft.
export function useCommentDraft(
  userId: string | null,
  issueId: number,
  box: CommentDraftBox,
  initialBody = '',
) {
  const [body, setBodyState] = useState(initialBody);
  // Read through a ref: a comment changed elsewhere must not replace the text being typed.
  const initialBodyRef = useRef(initialBody);
  initialBodyRef.current = initialBody;

  // Read in an effect so the stored text does not differ from the server markup.
  useEffect(() => {
    if (userId) setBodyState(readCommentDraft(userId, issueId, box) ?? initialBodyRef.current);
  }, [userId, issueId, box]);

  const setBody = (next: string) => {
    setBodyState(next);
    if (userId)
      writeCommentDraft(userId, issueId, box, next.trim() && next !== initialBody ? next : null);
  };

  const discard = () => {
    if (userId) writeCommentDraft(userId, issueId, box, null);
  };

  return { body, setBody, discard };
}
