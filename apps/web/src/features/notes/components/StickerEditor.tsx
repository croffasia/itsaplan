import { useEffect, useMemo } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import { useTranslations } from 'next-intl';
import EditorLinkPreview from '@/components/common/editor/EditorLinkPreview';
import { openLinkOnModifierClick } from '@/components/common/editor/modifierClickLink';
import { createLinkKeyboardHandlers } from '@/components/common/editor/linkKeyboardHandlers';
import { stickerEditorExtensions } from '../utils/stickerEditorExtensions';

export default function StickerEditor({
  value,
  onChange,
  onReady,
  editable,
}: {
  value: string;
  onChange: (markdown: string) => void;
  onReady?: (editor: Editor | null) => void;
  editable: boolean;
}) {
  const t = useTranslations('notes');
  const linkKeyboardHandlers = useMemo(createLinkKeyboardHandlers, []);
  const editor = useEditor({
    editable,
    extensions: stickerEditorExtensions(t('notePlaceholder')),
    content: value,
    editorProps: {
      attributes: { class: 'md-content nopan focus:outline-none' },
      handleClick(view, _pos, event) {
        return openLinkOnModifierClick(event, view.dom);
      },
      handleDOMEvents: linkKeyboardHandlers,
    },
    onUpdate: ({ editor }) => onChange(editor.storage.markdown.getMarkdown()),
  });

  useEffect(() => {
    onReady?.(editor);
  }, [editor, onReady]);

  useEffect(() => {
    if (editor && editor.isEditable !== editable) editor.setEditable(editable, false);
  }, [editor, editable]);

  if (!editor) return null;
  return (
    <>
      <EditorContent editor={editor} />
      <EditorLinkPreview editor={editor} />
    </>
  );
}
