import { mergeAttributes } from '@tiptap/core';
import { MentionNode } from '@repo/editor';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { ReactRenderer } from '@tiptap/react';
import { REFRESH_DECORATIONS } from '@/components/common/editor/refreshDecorations';
import Suggestion from '@tiptap/suggestion';
import MentionMenu, { type MentionMenuHandle } from '@/components/common/inputs/MentionMenu';
import type { MentionCandidate } from '@/lib/api/endpoints/mentions';
import { matchMentionCandidates } from '@/utils/mentions';

export type MentionOptions = {
  // Who the "@" menu offers. Read on every keystroke rather than captured once, so a
  // list that arrives after the editor was built is still offered.
  items: () => MentionCandidate[];
  // The viewer's own handle. A mention of it is painted in a second colour.
  self: () => string;
  // The name behind a lowercased handle, shown as the chip's tooltip.
  name: (handle: string) => string | undefined;
};

// Its own key, so this suggestion plugin and the slash command's can both run in
// one editor — two plugins under the default key are rejected by ProseMirror.
const mentionPluginKey = new PluginKey('mentionSuggestion');
const selfMentionKey = new PluginKey<DecorationSet>('selfMention');

// A decoration rather than a class set in renderHTML: the session can arrive after the
// nodes are drawn, and a decoration is recomputed on refresh where a node is not.
function selfMentions(doc: ProseMirrorNode, self: string): DecorationSet {
  if (!self) return DecorationSet.empty;
  const handle = self.toLowerCase();
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name === 'mention' && String(node.attrs.username).toLowerCase() === handle)
      decorations.push(Decoration.node(pos, pos + node.nodeSize, { class: 'mention-self' }));
  });
  return DecorationSet.create(doc, decorations);
}

export const Mention = MentionNode.extend<MentionOptions>({
  addOptions() {
    return { items: () => [], self: () => '', name: () => undefined };
  },

  renderHTML({ node, HTMLAttributes }) {
    const username = String(node.attrs.username);
    // The name behind the handle is only known while the roster is loaded, so it is
    // a tooltip rather than part of the chip.
    const name = this.options.name(username.toLowerCase());
    return [
      'span',
      mergeAttributes(HTMLAttributes, { class: 'mention', ...(name ? { title: name } : {}) }),
      `@${username}`,
    ];
  },

  addProseMirrorPlugins() {
    const { items, self } = this.options;
    return [
      new Plugin<DecorationSet>({
        key: selfMentionKey,
        state: {
          init: (_, state) => selfMentions(state.doc, self()),
          apply: (tr, previous) =>
            tr.docChanged || tr.getMeta(REFRESH_DECORATIONS)
              ? selfMentions(tr.doc, self())
              : previous.map(tr.mapping, tr.doc),
        },
        props: { decorations: (state) => selfMentionKey.getState(state) },
      }),
      Suggestion<MentionCandidate, MentionCandidate>({
        pluginKey: mentionPluginKey,
        editor: this.editor,
        char: '@',
        // Radix makes everything outside an open overlay inert, so the list mounts
        // inside the dialog the editor sits in.
        container: '[data-slot="dialog-content"]',
        items: ({ query }) => matchMentionCandidates(items(), query),
        command: ({ editor, range, props }) => {
          editor
            .chain()
            .focus()
            .insertContentAt(range, [
              { type: 'mention', attrs: { username: props.username } },
              { type: 'text', text: ' ' },
            ])
            .run();
        },
        render: () => {
          let component: ReactRenderer<MentionMenuHandle> | null = null;
          let unmount: (() => void) | null = null;

          return {
            onStart: (props) => {
              component = new ReactRenderer(MentionMenu, {
                props: { items: props.items, onPick: props.command },
                editor: props.editor,
                className: 'z-50',
              });
              unmount = props.mount(component.element);
            },
            onUpdate: (props) =>
              component?.updateProps({ items: props.items, onPick: props.command }),
            onKeyDown: (props) => component?.ref?.onKeyDown(props.event) ?? false,
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
