import { Extension, type Editor, type Range } from '@tiptap/core';
import { ReactRenderer } from '@tiptap/react';
import Suggestion from '@tiptap/suggestion';
import { Image as ImageIcon, SquareCode, Table, type LucideIcon } from 'lucide-react';
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
};

// Typing "/" opens a list of blocks to insert — how they are reached with nothing
// selected, where the bubble menu has nothing to hang off.
export const SlashCommand = Extension.create<SlashCommandOptions>({
  name: 'slashCommand',

  addProseMirrorPlugins() {
    const { codeBlockLabel, tableLabel, image, container } = this.options;

    return [
      Suggestion<SlashItem, SlashItem>({
        editor: this.editor,
        char: '/',
        container: container ?? '[data-slot="dialog-content"]',
        items: ({ query }) => {
          const items: SlashItem[] = [
            {
              title: codeBlockLabel,
              icon: SquareCode,
              run: ({ editor, range }) =>
                editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
            },
          ];
          if (tableLabel) {
            items.push({
              title: tableLabel,
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
          if (image) {
            items.push({
              title: image.label,
              icon: ImageIcon,
              run: ({ editor, range }) => {
                editor.chain().focus().deleteRange(range).run();
                image.onPick();
              },
            });
          }
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
