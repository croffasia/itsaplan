import type { Editor } from '@tiptap/react';
import { ReactRenderer } from '@tiptap/react';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import LinkBlockControls from './LinkBlockControls';
import { bareMarkdownUrls, editorLinkBlocks, type EditorLinkBlock } from './linkPresentation';
import type { LinkPreviewItem } from './LinkPreviewDialog';
import styles from './LinkPresentation.module.css';

type PresentationOptions = { enabled: boolean; compact: boolean; suspended: boolean };
type PresentationState = { blocks: EditorLinkBlock[]; sourceUnchanged: boolean };

export function createEditorLinkPresentation(
  editor: Editor,
  source: string,
  onPreview: (links: LinkPreviewItem[], trigger: HTMLButtonElement) => void,
) {
  const key = new PluginKey<PresentationState>('linkPresentation');
  const bareUrls = bareMarkdownUrls(source);
  const originalDoc = editor.state.doc;
  let options: PresentationOptions = { enabled: false, compact: false, suspended: false };
  let decorations = DecorationSet.empty;

  function build(blocks: EditorLinkBlock[], sourceUnchanged: boolean) {
    if (!options.enabled || options.suspended) return DecorationSet.empty;
    const result: Decoration[] = [];
    for (const block of blocks) {
      const compact = options.compact && block.bare && sourceUnchanged;
      if (compact)
        result.push(Decoration.node(block.from, block.to, { class: styles.compactBlock }));
      result.push(
        Decoration.widget(
          block.to - 1,
          () => {
            const sourceDoc = editor.state.doc;
            const links = block.links.map((link) => ({
              url: link.url,
              label: link.label,
              onEdit: editor.isEditable
                ? () => {
                    if (editor.isDestroyed || !editor.isEditable || !sourceDoc.eq(editor.state.doc))
                      return;
                    editor.chain().focus().setTextSelection({ from: link.from, to: link.to }).run();
                  }
                : undefined,
            }));
            const renderer = new ReactRenderer(LinkBlockControls, {
              editor,
              as: 'span',
              className: styles.widget,
              props: { links, compact, onPreview },
            });
            renderer.element.setAttribute('data-link-widget', '');
            renderers.set(renderer.element, renderer);
            return renderer.element;
          },
          {
            side: 1,
            marks: [],
            stopEvent: () => true,
            ignoreSelection: true,
            destroy: (node) => {
              renderers.get(node)?.destroy();
              renderers.delete(node);
            },
          },
        ),
      );
    }
    return DecorationSet.create(editor.state.doc, result);
  }

  const renderers = new Map<Node, ReactRenderer>();
  const plugin = new Plugin<PresentationState>({
    key,
    state: {
      init: (_, state) => ({
        blocks: editorLinkBlocks(state.doc, bareUrls, window.location.origin),
        sourceUnchanged: true,
      }),
      apply: (transaction, previous) => {
        if (!transaction.docChanged) return previous;
        return {
          blocks: editorLinkBlocks(transaction.doc, bareUrls, window.location.origin),
          sourceUnchanged: transaction.doc.eq(originalDoc),
        };
      },
    },
    props: { decorations: () => decorations },
    view: (view) => {
      let previous = key.getState(view.state)!;
      return {
        update: (nextView) => {
          const next = key.getState(nextView.state)!;
          if (previous === next) return;
          previous = next;
          decorations = build(next.blocks, next.sourceUnchanged);
          nextView.updateState(nextView.state);
        },
        destroy: () => {
          for (const renderer of renderers.values()) renderer.destroy();
          renderers.clear();
        },
      };
    },
  });

  return {
    plugin,
    key,
    configure(next: PresentationOptions) {
      if (
        options.enabled === next.enabled &&
        options.compact === next.compact &&
        options.suspended === next.suspended
      )
        return;
      options = next;
      const state = key.getState(editor.state);
      if (!state || editor.isDestroyed) return;
      decorations = build(state.blocks, state.sourceUnchanged);
      editor.view.updateState(editor.state);
    },
  };
}
