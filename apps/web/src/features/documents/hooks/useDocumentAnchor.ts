import { useEffect } from 'react';
import type { Editor } from '@tiptap/react';

export function useDocumentAnchor(editor: Editor | null) {
  useEffect(() => {
    if (!editor) return;
    let last: HTMLElement | null = null;
    let lastId = '';
    let frame = 0;
    const jump = () => {
      const id = window.location.hash.slice(1);
      if (!/^block-[A-Za-z0-9_-]{1,64}$/.test(id)) return;
      if (lastId === id && last?.isConnected) return;
      let target = window.document.getElementById(id);
      if (!target)
        editor.state.doc.descendants((node, position) => {
          if (target || node.attrs.blockId !== id.slice(6)) return;
          const element = editor.view.nodeDOM(position);
          if (element instanceof HTMLElement) target = element;
        });
      if (!target || !editor.view.dom.contains(target) || target === last) return;
      target.scrollIntoView({
        block: 'center',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'instant'
          : 'smooth',
      });
      last = target;
      lastId = id;
    };
    const hash = () => {
      last = null;
      jump();
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(jump);
    };
    editor.on('transaction', schedule);
    window.addEventListener('hashchange', hash);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      editor.off('transaction', schedule);
      window.removeEventListener('hashchange', hash);
    };
  }, [editor]);
}
