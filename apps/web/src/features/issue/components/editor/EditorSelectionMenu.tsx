import { type Editor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import {
  Bold,
  Code,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  SquareCode,
  Strikethrough,
  type LucideIcon,
} from 'lucide-react';
import EditorToolbarButton from './EditorToolbarButton';

function setLink(editor: Editor) {
  const url = window.prompt('Link URL', editor.getAttributes('link').href ?? '');
  if (url === null) return;
  if (url === '') editor.chain().focus().unsetLink().run();
  else editor.chain().focus().setLink({ href: url }).run();
}

// `name` is the mark or node the button toggles, which is also what lights it up.
const ITEMS: { name: string; icon: LucideIcon; run: (editor: Editor) => void }[] = [
  { name: 'bold', icon: Bold, run: (editor) => editor.chain().focus().toggleBold().run() },
  { name: 'italic', icon: Italic, run: (editor) => editor.chain().focus().toggleItalic().run() },
  {
    name: 'strike',
    icon: Strikethrough,
    run: (editor) => editor.chain().focus().toggleStrike().run(),
  },
  { name: 'code', icon: Code, run: (editor) => editor.chain().focus().toggleCode().run() },
  {
    name: 'codeBlock',
    icon: SquareCode,
    run: (editor) => editor.chain().focus().toggleCodeBlock().run(),
  },
  { name: 'link', icon: LinkIcon, run: setLink },
  {
    name: 'blockquote',
    icon: Quote,
    run: (editor) => editor.chain().focus().toggleBlockquote().run(),
  },
  {
    name: 'bulletList',
    icon: List,
    run: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    name: 'orderedList',
    icon: ListOrdered,
    run: (editor) => editor.chain().focus().toggleOrderedList().run(),
  },
];

export default function EditorSelectionMenu({ editor }: { editor: Editor }) {
  return (
    <BubbleMenu
      editor={editor}
      options={{ placement: 'top' }}
      className="flex items-center gap-0.5 rounded-md border bg-popover p-1 shadow-md"
    >
      {ITEMS.map((item) => (
        <EditorToolbarButton
          key={item.name}
          active={editor.isActive(item.name)}
          onClick={() => item.run(editor)}
        >
          <item.icon />
        </EditorToolbarButton>
      ))}
    </BubbleMenu>
  );
}
