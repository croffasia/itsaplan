import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { type Editor, useEditorState } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  SquareCheck,
  SquareCode,
  Strikethrough,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Transaction } from '@tiptap/pm/state';
import type { Messages } from '@/i18n/messages';
import EditorLinkForm from './EditorLinkForm';
import EditorToolbarButton from './EditorToolbarButton';
import { EDIT_LINK } from './editLink';

// `name` plus `attrs` is the mark or node the button toggles, which is also what lights it up.
const ITEMS: {
  name: string;
  label: keyof Messages['common']['editor'];
  attrs?: { level: 1 | 2 };
  icon: LucideIcon;
  run: (editor: Editor, openLink: () => void) => void;
}[] = [
  {
    name: 'heading',
    label: 'heading1',
    attrs: { level: 1 },
    icon: Heading1,
    run: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    name: 'heading',
    label: 'heading2',
    attrs: { level: 2 },
    icon: Heading2,
    run: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    name: 'bold',
    label: 'bold',
    icon: Bold,
    run: (editor) => editor.chain().focus().toggleBold().run(),
  },
  {
    name: 'italic',
    label: 'italic',
    icon: Italic,
    run: (editor) => editor.chain().focus().toggleItalic().run(),
  },
  {
    name: 'strike',
    label: 'strike',
    icon: Strikethrough,
    run: (editor) => editor.chain().focus().toggleStrike().run(),
  },
  {
    name: 'code',
    label: 'inlineCode',
    icon: Code,
    run: (editor) => editor.chain().focus().toggleCode().run(),
  },
  {
    name: 'codeBlock',
    label: 'codeBlock',
    icon: SquareCode,
    run: (editor) => editor.chain().focus().toggleCodeBlock().run(),
  },
  { name: 'link', label: 'link', icon: LinkIcon, run: (_editor, openLink) => openLink() },
  {
    name: 'blockquote',
    label: 'quote',
    icon: Quote,
    run: (editor) => editor.chain().focus().toggleBlockquote().run(),
  },
  {
    name: 'bulletList',
    label: 'bulletList',
    icon: List,
    run: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    name: 'orderedList',
    label: 'numberedList',
    icon: ListOrdered,
    run: (editor) => editor.chain().focus().toggleOrderedList().run(),
  },
];

const menuHasFocus = () => !!document.activeElement?.closest('[data-selection-menu]');

export default function EditorSelectionMenu({
  editor,
  placement = 'top',
  taskList = false,
  children,
}: {
  editor: Editor;
  children?: ReactNode;
  // Above the selection by default. A field with a label right over it passes
  // "bottom" so the menu does not cover the label.
  placement?: 'top' | 'bottom';
  // Only where the task-list extensions are registered.
  taskList?: boolean;
}) {
  const t = useTranslations('common.editor');
  const [linkOpen, setLinkOpen] = useState(false);
  // Re-renders when what the buttons light up changes.
  useEditorState({
    editor,
    selector: ({ editor: current }) =>
      ITEMS.map((item) => current.isActive(item.name, item.attrs)).concat(
        current.isActive('taskList'),
      ),
  });
  // A new object would re-send the options to the plugin on every render.
  const options = useMemo(() => ({ placement, onHide: () => setLinkOpen(false) }), [placement]);

  useEffect(() => {
    const transaction = ({ transaction }: { transaction: Transaction }) => {
      if (transaction.getMeta(EDIT_LINK)) setLinkOpen(true);
      // A new selection starts on the buttons again.
      else if (transaction.selectionSet && !menuHasFocus()) setLinkOpen(false);
    };
    editor.on('transaction', transaction);
    return () => {
      editor.off('transaction', transaction);
    };
  }, [editor]);

  return (
    <BubbleMenu
      editor={editor}
      options={options}
      data-selection-menu=""
      className="flex max-w-[calc(100vw-2rem)] flex-wrap items-center gap-0.5 rounded-lg border border-border/55 bg-popover p-1 shadow-[var(--overlay-shadow)]"
    >
      {linkOpen ? (
        <EditorLinkForm editor={editor} onDone={() => setLinkOpen(false)} />
      ) : (
        <>
          {ITEMS.map((item) => (
            <EditorToolbarButton
              key={item.label}
              title={t(item.label)}
              active={editor.isActive(item.name, item.attrs)}
              onClick={() => item.run(editor, () => setLinkOpen(true))}
            >
              <item.icon />
            </EditorToolbarButton>
          ))}
          {taskList && (
            <EditorToolbarButton
              active={editor.isActive('taskList')}
              title={t('todoList')}
              onClick={() => editor.chain().focus().toggleTaskList().run()}
            >
              <SquareCheck />
            </EditorToolbarButton>
          )}
          {children}
        </>
      )}
    </BubbleMenu>
  );
}
