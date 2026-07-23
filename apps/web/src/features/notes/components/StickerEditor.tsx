import { useEffect } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Markdown } from 'tiptap-markdown';

// The markdown body of a sticky note. Unlike the issue editor there is no bubble
// menu — a persistent toolbar (StickerToolbar) drives the commands — and task
// lists are enabled so a note can mix text with checkable items. Content in and
// out is markdown, matching how it is stored on the board canvas.
export default function StickerEditor({
  value,
  onChange,
  onReady,
}: {
  value: string;
  onChange: (markdown: string) => void;
  onReady?: (editor: Editor | null) => void;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Write a note…' }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Markdown.configure({ html: false, breaks: true }),
    ],
    content: value,
    editorProps: { attributes: { class: 'md-content focus:outline-none' } },
    onUpdate: ({ editor }) => onChange(editor.storage.markdown.getMarkdown()),
  });

  useEffect(() => {
    onReady?.(editor);
  }, [editor, onReady]);

  if (!editor) return null;
  return <EditorContent editor={editor} />;
}
