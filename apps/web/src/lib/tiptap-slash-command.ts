import { Extension, type Editor, type Range } from '@tiptap/core';
import { ReactRenderer } from '@tiptap/react';
import Suggestion from '@tiptap/suggestion';
import {
  CheckSquare2,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  List,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
  SquareCode,
  Table,
  type LucideIcon,
} from 'lucide-react';
import EditorSlashMenu, { type SlashMenuRef } from '@/components/common/editor/EditorSlashMenu';

export type SlashItem = {
  title: string;
  icon: LucideIcon;
  // The range covers the typed "/query", which the command removes before acting.
  run: (props: { editor: Editor; range: Range }) => void;
};

export type SlashCommandOptions = {
  // Where the list mounts. Radix makes everything outside the open overlay inert,
  // so it has to be that overlay's element. Defaults to an open dialog, falling
  // back to document.body when the selector matches nothing.
  container?: string;
  // The name of the item, in the reader's language.
  codeBlockLabel: string;
  // Omitted where the editor has no table extension, which drops the Table item.
  tableLabel?: string;
  // Omitted where there is nothing to pick from, which drops the Image item.
  image?: { label: string; onPick: () => void };
  // Editors that expose a richer block schema opt into these commands. Keeping
  // this optional preserves the compact Issue and agent-instruction menus.
  blocks?: {
    paragraph: string;
    headings: [string, string, string, string, string, string];
    bulletList: string;
    orderedList: string;
    taskList: string;
    quote: string;
    divider: string;
  };
};

export function buildSlashItems(options: SlashCommandOptions): SlashItem[] {
  const items: SlashItem[] = [];
  if (options.blocks) {
    items.push({
      title: options.blocks.paragraph,
      icon: Pilcrow,
      run: ({ editor, range }) => editor.chain().focus().deleteRange(range).setParagraph().run(),
    });
    const headingIcons = [Heading1, Heading2, Heading3, Heading3, Heading3, Heading3];
    options.blocks.headings.forEach((title, index) => {
      const level = (index + 1) as 1 | 2 | 3 | 4 | 5 | 6;
      items.push({
        title,
        icon: headingIcons[index] ?? Heading3,
        run: ({ editor, range }) =>
          editor.chain().focus().deleteRange(range).setHeading({ level }).run(),
      });
    });
    items.push(
      {
        title: options.blocks.bulletList,
        icon: List,
        run: ({ editor, range }) =>
          editor.chain().focus().deleteRange(range).toggleBulletList().run(),
      },
      {
        title: options.blocks.orderedList,
        icon: ListOrdered,
        run: ({ editor, range }) =>
          editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
      },
      {
        title: options.blocks.taskList,
        icon: CheckSquare2,
        run: ({ editor, range }) =>
          editor.chain().focus().deleteRange(range).toggleTaskList().run(),
      },
      {
        title: options.blocks.quote,
        icon: Quote,
        run: ({ editor, range }) =>
          editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
      },
    );
  }
  items.push({
    title: options.codeBlockLabel,
    icon: SquareCode,
    run: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  });
  if (options.blocks) {
    items.push({
      title: options.blocks.divider,
      icon: Minus,
      run: ({ editor, range }) =>
        editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
    });
  }
  if (options.tableLabel) {
    items.push({
      title: options.tableLabel,
      icon: Table,
      run: ({ editor, range }) =>
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
          .run(),
    });
  }
  if (options.image) {
    items.push({
      title: options.image.label,
      icon: ImageIcon,
      run: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();
        options.image?.onPick();
      },
    });
  }
  return items;
}

// Typing "/" opens a list of blocks to insert — how they are reached with nothing
// selected, where the bubble menu has nothing to hang off.
export const SlashCommand = Extension.create<SlashCommandOptions>({
  name: 'slashCommand',

  addProseMirrorPlugins() {
    const { container } = this.options;

    return [
      Suggestion<SlashItem, SlashItem>({
        editor: this.editor,
        char: '/',
        container: container ?? '[data-slot="dialog-content"]',
        items: ({ query }) => {
          const items = buildSlashItems(this.options);
          const needle = query.toLowerCase();
          return items.filter((item) => item.title.toLowerCase().includes(needle));
        },
        command: ({ editor, range, props }) => props.run({ editor, range }),
        render: () => {
          let component: ReactRenderer<SlashMenuRef> | null = null;
          let unmount: (() => void) | null = null;

          return {
            onStart: (props) => {
              component = new ReactRenderer(EditorSlashMenu, {
                props,
                editor: props.editor,
                // The plugin sets no stacking order; the menu mounts on the body,
                // after the panels it opens over, so an equal z-index still paints it
                // above them.
                className: 'z-50',
              });
              unmount = props.mount(component.element);
            },
            onUpdate: (props) => component?.updateProps(props),
            onKeyDown: (props) => component?.ref?.onKeyDown(props) ?? false,
            onExit: () => {
              unmount?.();
              component?.destroy();
              component = null;
              unmount = null;
            },
          };
        },
      }),
    ];
  },
});
