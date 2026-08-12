import { Extension, type Editor, type Range } from '@tiptap/core';
import { ReactRenderer } from '@tiptap/react';
import Suggestion from '@tiptap/suggestion';
import { Image as ImageIcon, SquareCode, type LucideIcon } from 'lucide-react';
import EditorSlashMenu, { type SlashMenuRef } from '../components/editor/EditorSlashMenu';

export type SlashItem = {
  title: string;
  icon: LucideIcon;
  // The range covers the typed "/query", which the command removes before acting.
  run: (props: { editor: Editor; range: Range }) => void;
};

export type SlashCommandOptions = {
  // Omitted where there is nothing to pick from, which drops the Image item.
  onPickImage?: () => void;
  // The names of the items, in the reader's language.
  labels: { codeBlock: string; image: string };
};

// Typing "/" opens a list of blocks to insert — how they are reached with nothing
// selected, where the bubble menu has nothing to hang off.
export const SlashCommand = Extension.create<SlashCommandOptions>({
  name: 'slashCommand',

  addProseMirrorPlugins() {
    const { onPickImage, labels } = this.options;

    return [
      Suggestion<SlashItem, SlashItem>({
        editor: this.editor,
        char: '/',
        // In a dialog the list must mount inside it — Radix makes the rest of the
        // page inert. Falls back to document.body when no dialog is open.
        container: '[data-slot="dialog-content"]',
        items: ({ query }) => {
          const items: SlashItem[] = [
            {
              title: labels.codeBlock,
              icon: SquareCode,
              run: ({ editor, range }) =>
                editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
            },
          ];
          if (onPickImage) {
            items.push({
              title: labels.image,
              icon: ImageIcon,
              run: ({ editor, range }) => {
                editor.chain().focus().deleteRange(range).run();
                onPickImage();
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
                // The plugin sets no stacking order; the side panel below is z-40.
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
