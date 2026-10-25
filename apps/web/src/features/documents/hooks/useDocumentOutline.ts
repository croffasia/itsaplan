'use client';

import { useEffect, useMemo, useState, type RefObject } from 'react';
import type { Editor } from '@tiptap/react';

export type DocumentOutlineItem = { level: number; position: number; text: string };

// A heading becomes the current section once its top passes this line below the top
// of the scroll container. The line sits under the headings' scroll margin, so the
// heading a jump lands on is the current one.
const ACTIVE_LINE = 96;

export function useDocumentOutline(
  editor: Editor | null,
  scrollRef: RefObject<HTMLElement | null>,
) {
  const [revision, setRevision] = useState(0);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    if (!editor) return;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = ({ transaction }: { transaction: { docChanged: boolean } }) => {
      if (transaction.docChanged) {
        clearTimeout(timer);
        timer = setTimeout(() => setRevision((value) => value + 1), 300);
      }
    };
    editor.on('transaction', refresh);
    return () => {
      clearTimeout(timer);
      editor.off('transaction', refresh);
    };
  }, [editor]);

  const outline = useMemo(() => {
    void revision;
    const items: DocumentOutlineItem[] = [];
    editor?.state.doc.descendants((node, position) => {
      if (node.type.name !== 'heading') return;
      items.push({ level: Number(node.attrs.level) || 1, position, text: node.textContent.trim() });
    });
    return items;
  }, [editor, revision]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!editor || !container || outline.length === 0) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      if (editor.isDestroyed) return;
      // The last headings of a page may never reach the line, so the end of the page
      // selects the last one.
      if (
        container.scrollTop > 0 &&
        container.scrollTop + container.clientHeight >= container.scrollHeight - 2
      ) {
        setActiveIndex(outline.length - 1);
        return;
      }
      const line = container.getBoundingClientRect().top + ACTIVE_LINE;
      let index = -1;
      for (const [itemIndex, item] of outline.entries()) {
        const element = editor.view.nodeDOM(item.position);
        if (!(element instanceof HTMLElement) || element.getBoundingClientRect().top > line) break;
        index = itemIndex;
      }
      setActiveIndex(index);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    container.addEventListener('scroll', schedule, { passive: true });
    return () => {
      container.removeEventListener('scroll', schedule);
      cancelAnimationFrame(frame);
    };
  }, [editor, outline, scrollRef]);

  const jumpTo = (index: number) => {
    const item = outline[index];
    if (!editor || editor.isDestroyed || !item) return;
    const element = editor.view.nodeDOM(item.position);
    if (element instanceof HTMLElement) element.scrollIntoView({ block: 'start' });
    if (editor.isEditable) {
      editor
        .chain()
        .setTextSelection(item.position + 1)
        .focus(undefined, { scrollIntoView: false })
        .run();
    }
    setActiveIndex(index);
  };

  return { outline, activeIndex, jumpTo };
}
