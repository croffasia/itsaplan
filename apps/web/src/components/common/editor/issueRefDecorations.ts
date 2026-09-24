import { Extension } from '@tiptap/core';
import { ReactRenderer, type Editor as ReactEditor } from '@tiptap/react';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { issuePath } from '@/utils/paths';
import { splitIssueRefs } from './issueRef';
import { REFRESH_DECORATIONS } from './refreshDecorations';
import IssueRefChip from './IssueRefChip';

type IssueRefOptions = {
  keys: () => readonly string[];
  open: (href: string) => void;
  // Read-only text shows the issue's state and title. Editable text keeps the
  // identifier as typed, so the caret moves through characters that are all there.
  rich: () => boolean;
};

const key = new PluginKey<DecorationSet>('issueRef');

export const IssueRef = Extension.create<IssueRefOptions>({
  name: 'issueRef',

  addOptions() {
    return { keys: () => [], open: () => undefined, rich: () => false };
  },

  addProseMirrorPlugins() {
    const options = this.options;
    const editor = this.editor as ReactEditor;
    const renderers = new Map<Node, ReactRenderer>();

    function build(doc: ProseMirrorNode) {
      const keys = options.keys();
      if (keys.length === 0) return DecorationSet.empty;
      const rich = options.rich();
      const decorations: Decoration[] = [];
      doc.descendants((node, pos) => {
        if (node.type.name === 'codeBlock') return false;
        if (!node.isText || !node.text) return;
        if (node.marks.some((mark) => mark.type.name === 'code' || mark.type.name === 'link'))
          return;
        let from = pos;
        for (const part of splitIssueRefs(node.text, keys)) {
          if (part.kind === 'text') {
            from += part.text.length;
            continue;
          }
          const to = from + part.key.length + 1 + String(part.sequence).length;
          const href = issuePath(part.key, part.sequence);
          if (rich) {
            decorations.push(
              Decoration.inline(from, to, { class: 'issue-ref-source', 'aria-hidden': 'true' }),
              Decoration.widget(
                from,
                () => {
                  const renderer = new ReactRenderer(IssueRefChip, {
                    editor,
                    as: 'span',
                    props: { projectKey: part.key, sequence: part.sequence },
                  });
                  renderer.element.setAttribute('data-issue-ref', '');
                  renderers.set(renderer.element, renderer);
                  return renderer.element;
                },
                {
                  side: -1,
                  key: `issue-ref:${part.key}-${part.sequence}`,
                  ignoreSelection: true,
                  stopEvent: () => true,
                  destroy: (dom) => {
                    renderers.get(dom)?.destroy();
                    renderers.delete(dom);
                  },
                },
              ),
            );
          } else {
            decorations.push(
              Decoration.inline(from, to, { nodeName: 'a', class: 'issue-ref', href }),
            );
          }
          from = to;
        }
      });
      return DecorationSet.create(doc, decorations);
    }

    return [
      new Plugin<DecorationSet>({
        key,
        state: {
          init: (_, state) => build(state.doc),
          apply: (tr, previous) =>
            tr.docChanged || tr.getMeta(REFRESH_DECORATIONS)
              ? build(tr.doc)
              : previous.map(tr.mapping, tr.doc),
        },
        view: () => ({
          destroy: () => {
            for (const renderer of renderers.values()) renderer.destroy();
            renderers.clear();
          },
        }),
        props: {
          decorations: (state) => key.getState(state),
          handleDOMEvents: {
            // While the field is being edited a click places the caret. Before that,
            // the same click opens the issue; preventDefault keeps the editor from
            // taking focus and swapping the chip away under the pointer.
            mousedown(view, event) {
              if (view.editable && view.hasFocus()) return false;
              if (!(event.target instanceof Element)) return false;
              const anchor = event.target.closest('a.issue-ref');
              if (!anchor || event.metaKey || event.ctrlKey || event.button !== 0) return false;
              event.preventDefault();
              const href = anchor.getAttribute('href');
              if (href) options.open(href);
              return true;
            },
          },
          handleClick(view, _pos, event) {
            if (event.defaultPrevented || view.editable) return false;
            if (!(event.target instanceof Element)) return false;
            const anchor = event.target.closest('a.issue-ref');
            if (!anchor || event.metaKey || event.ctrlKey || event.button !== 0) return false;
            event.preventDefault();
            const href = anchor.getAttribute('href');
            if (href) options.open(href);
            return true;
          },
        },
      }),
    ];
  },
});
