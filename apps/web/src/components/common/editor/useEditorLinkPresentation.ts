import { useCallback, useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { createEditorLinkPresentation } from './editorLinkPresentation';
import { useLinkInputCapabilities } from './useLinkInputCapabilities';
import type { LinkPreviewItem } from './LinkPreviewDialog';

type PreviewSelection = { links: LinkPreviewItem[]; trigger: HTMLButtonElement };

export function useEditorLinkPresentation(editor: Editor, source: string, compactAllowed: boolean) {
  const { compact, explicit } = useLinkInputCapabilities();
  const [dialog, setDialog] = useState<PreviewSelection | null>(null);
  const presentation = useRef<ReturnType<typeof createEditorLinkPresentation> | null>(null);
  const sourceRef = useRef(source);
  const capabilityRef = useRef({ compact, explicit });
  const compactRef = useRef(compactAllowed);
  const dialogRef = useRef(dialog);
  dialogRef.current = dialog;
  const suspended = useRef(false);

  const refresh = useCallback(() => {
    presentation.current?.configure({
      enabled: capabilityRef.current.explicit,
      compact: capabilityRef.current.compact && compactRef.current,
      suspended: suspended.current,
    });
  }, []);

  useEffect(() => {
    const instance = createEditorLinkPresentation(editor, sourceRef.current, (links, trigger) => {
      setDialog({ links, trigger });
    });
    presentation.current = instance;
    editor.registerPlugin(instance.plugin);
    const root = editor.view.dom;
    const suspend = () => {
      suspended.current = true;
      refresh();
    };
    const resume = () => {
      if (dialogRef.current || editor.isFocused || editor.view.composing) return;
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed && root.contains(selection.anchorNode)) return;
      suspended.current = false;
      refresh();
    };
    const focus = (event: FocusEvent) => {
      if ((event.target as Element | null)?.closest('[data-link-presentation]')) return;
      if (editor.isEditable) suspend();
    };
    const pointer = (event: PointerEvent) => {
      if ((event.target as Element | null)?.closest('a, [data-link-presentation]')) return;
      suspend();
    };
    const selection = () => {
      const range = window.getSelection();
      if (
        range &&
        !range.isCollapsed &&
        (root.contains(range.anchorNode) || root.contains(range.focusNode))
      )
        suspend();
    };
    const changed = () => setDialog(null);
    root.addEventListener('focusin', focus);
    root.addEventListener('pointerdown', pointer, true);
    root.addEventListener('compositionstart', suspend);
    root.addEventListener('compositionend', resume);
    root.addEventListener('focusout', resume);
    root.addEventListener('blur', resume);
    document.addEventListener('selectionchange', selection);
    editor.on('update', changed);
    refresh();
    return () => {
      root.removeEventListener('focusin', focus);
      root.removeEventListener('pointerdown', pointer, true);
      root.removeEventListener('compositionstart', suspend);
      root.removeEventListener('compositionend', resume);
      root.removeEventListener('focusout', resume);
      root.removeEventListener('blur', resume);
      document.removeEventListener('selectionchange', selection);
      editor.off('update', changed);
      editor.unregisterPlugin(instance.key);
      presentation.current = null;
    };
  }, [editor, refresh]);

  useEffect(() => {
    if (!dialog) return;
    dialog.trigger.setAttribute('aria-expanded', 'true');
    return () => dialog.trigger.setAttribute('aria-expanded', 'false');
  }, [dialog]);

  useEffect(() => {
    if (dialog) return;
    capabilityRef.current = { compact, explicit };
    compactRef.current = compactAllowed;
    refresh();
  }, [compact, explicit, compactAllowed, dialog, refresh]);

  return { dialog, closeDialog: () => setDialog(null) };
}
