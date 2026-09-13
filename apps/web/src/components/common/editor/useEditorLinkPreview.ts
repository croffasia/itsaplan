import { useCallback, useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { previewableLink } from './previewableLink';

export function useEditorLinkPreview(editor: Editor) {
  const [anchor, setAnchor] = useState<HTMLAnchorElement | null>(null);
  const [candidateAnchor, setCandidateAnchor] = useState<HTMLAnchorElement | null>(null);
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLAnchorElement | null>(null);
  const visibleRef = useRef(false);
  const openTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const keepOpen = useCallback(() => {
    clearTimeout(closeTimer.current);
    clearTimeout(clearTimer.current);
  }, []);
  const close = useCallback(() => {
    if (!anchorRef.current) return;
    clearTimeout(openTimer.current);
    openTimer.current = undefined;
    clearTimeout(closeTimer.current);
    clearTimeout(clearTimer.current);
    visibleRef.current = false;
    setOpen(false);
    clearTimer.current = setTimeout(() => {
      anchorRef.current = null;
      setAnchor(null);
      setCandidateAnchor(null);
    }, 160);
  }, []);
  const leave = useCallback(() => {
    clearTimeout(openTimer.current);
    openTimer.current = undefined;
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(close, 120);
  }, [close]);

  useEffect(() => {
    const root = editor.view.dom;
    const enter = (event: Event) => {
      if (event instanceof PointerEvent && event.pointerType === 'touch') return;
      const link = previewableLink(event.target, root);
      if (!link) return;
      keepOpen();
      if (anchorRef.current === link && (visibleRef.current || openTimer.current)) return;
      clearTimeout(openTimer.current);
      anchorRef.current = link;
      setCandidateAnchor(link);
      visibleRef.current = false;
      setOpen(false);
      openTimer.current = setTimeout(() => {
        openTimer.current = undefined;
        setAnchor(link);
        visibleRef.current = true;
        setOpen(true);
      }, 650);
    };
    const exit = (event: MouseEvent | FocusEvent) => {
      if (anchorRef.current?.contains(event.relatedTarget as Node | null)) return;
      leave();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !anchorRef.current) return;
      if (visibleRef.current) {
        event.preventDefault();
        event.stopPropagation();
      }
      close();
    };
    root.addEventListener('pointerover', enter);
    root.addEventListener('pointerout', exit);
    root.addEventListener('focusin', enter);
    root.addEventListener('focusout', exit);
    document.addEventListener('keydown', escape, true);
    window.addEventListener('scroll', close, true);
    return () => {
      root.removeEventListener('pointerover', enter);
      root.removeEventListener('pointerout', exit);
      root.removeEventListener('focusin', enter);
      root.removeEventListener('focusout', exit);
      document.removeEventListener('keydown', escape, true);
      window.removeEventListener('scroll', close, true);
      clearTimeout(openTimer.current);
      clearTimeout(closeTimer.current);
      clearTimeout(clearTimer.current);
    };
  }, [editor, close, leave, keepOpen]);

  return { anchor, candidateAnchor, open, keepOpen, leave, close };
}
