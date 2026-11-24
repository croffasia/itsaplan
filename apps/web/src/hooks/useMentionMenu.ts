import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import type { MentionMenuHandle } from '@/components/common/inputs/MentionMenu';
import type { MentionCandidate } from '@/lib/api/endpoints/mentions';
import { matchMentionCandidates } from '@/utils/mentions';

// The "@" menu of a plain textarea. Typing "@" opens a list of who can be mentioned;
// picking one writes their handle as @username into the text, which is what the api
// resolves to notify a member or start an agent's run. The caller passes `ref` and the
// handlers to its textarea, and renders MentionMenu with `menuRef`, `matches` and
// `pick` in a container that does not clip it.

// The "@query" being typed: the text after the "@", and the index of the "@" itself,
// so a pick replaces the whole span.
interface MentionQuery {
  query: string;
  anchor: number;
}

export function useMentionMenu(
  value: string,
  onValueChange: (value: string) => void,
  candidates: MentionCandidate[],
) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const menuRef = useRef<MentionMenuHandle | null>(null);
  const [menu, setMenu] = useState<MentionQuery | null>(null);
  const [pendingCaret, setPendingCaret] = useState<number | null>(null);

  const matches = useMemo(
    () => (menu ? matchMentionCandidates(candidates, menu.query) : []),
    [candidates, menu],
  );

  // The value changes asynchronously, so the caret is set once the new text renders.
  useEffect(() => {
    if (pendingCaret == null) return;
    const textarea = ref.current;
    if (textarea) {
      textarea.focus();
      textarea.setSelectionRange(pendingCaret, pendingCaret);
    }
    setPendingCaret(null);
  }, [pendingCaret]);

  // An "@" at a word boundary followed by characters that are neither a space nor an "@".
  const onChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const next = event.target.value;
    const caret = event.target.selectionStart ?? next.length;
    onValueChange(next);
    const typed = next.slice(0, caret).match(/(?:^|\s)@([^\s@]*)$/);
    setMenu(typed ? { query: typed[1], anchor: caret - typed[1].length - 1 } : null);
  };

  const pick = (candidate: MentionCandidate) => {
    if (!menu) return;
    const handle = `@${candidate.username}`;
    const caret = ref.current?.selectionStart ?? value.length;
    onValueChange(`${value.slice(0, menu.anchor)}${handle} ${value.slice(caret)}`);
    setMenu(null);
    setPendingCaret(menu.anchor + handle.length + 1);
  };

  // True when the key belonged to the open menu, so the caller does nothing with it.
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (matches.length === 0) return false;
    if (event.key === 'Escape') setMenu(null);
    else if (!menuRef.current?.onKeyDown(event)) return false;
    event.preventDefault();
    return true;
  };

  return { ref, menuRef, matches, onChange, onKeyDown, pick, close: () => setMenu(null) };
}
