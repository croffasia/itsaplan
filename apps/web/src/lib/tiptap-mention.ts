import { Node, mergeAttributes } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import { ReactRenderer } from '@tiptap/react';
import Suggestion from '@tiptap/suggestion';
import EditorMentionMenu, {
  type MentionMenuRef,
} from '@/components/common/editor/EditorMentionMenu';

// Who can be mentioned: a project member or an agent, addressed by their handle.
export interface MentionCandidate {
  userId: string;
  name: string;
  username: string;
  kind: 'member' | 'agent';
}

export type MentionOptions = {
  // Read on every keystroke rather than captured once, so a roster that arrives
  // after the editor was built is still offered.
  items: () => MentionCandidate[];
};

// Its own key, so this suggestion plugin and the slash command's can both run in
// one editor — two plugins under the default key are rejected by ProseMirror.
const mentionPluginKey = new PluginKey('mentionSuggestion');

// A mention in the text is @handle — a member's username, or an agent's. Handles
// hold letters, digits and . _ - and never end on . or -, so a mention that closes a
// sentence keeps the punctuation out of it; the lookbehind keeps an email address
// from reading as one. The api parses the stored markdown with the same rule.
const MENTION_RE = /(?<![\w@.-])@([a-zA-Z0-9_](?:[a-zA-Z0-9._-]*[a-zA-Z0-9_])?)/g;

// Rebuilds one text node as a run of text and mention elements. Returns null when
// the text holds no mention, so the caller leaves the node alone.
function mentionFragment(text: string): DocumentFragment | null {
  const matches = [...text.matchAll(MENTION_RE)];
  if (matches.length === 0) return null;
  const fragment = document.createDocumentFragment();
  let cursor = 0;
  for (const match of matches) {
    const start = match.index;
    if (start > cursor) fragment.append(text.slice(cursor, start));
    const element = document.createElement('span');
    element.setAttribute('data-mention', match[1]);
    fragment.append(element);
    cursor = start + match[0].length;
  }
  if (cursor < text.length) fragment.append(text.slice(cursor));
  return fragment;
}

// Turns every @handle in the markdown-rendered HTML into a mention element, so the
// editor reads it back as a node. Code and links are left as written: an @ in them
// is part of the code or the URL.
function markMentions(root: HTMLElement): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const texts: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node as Text;
    if (text.data.includes('@') && !text.parentElement?.closest('code, pre, a')) texts.push(text);
  }
  for (const text of texts) {
    const fragment = mentionFragment(text.data);
    if (fragment) text.replaceWith(fragment);
  }
}

// A mention is its own inline node so it reads as one chip: the caret steps over it
// and a delete removes the whole handle. It serializes back to plain @handle, which
// is what the api stores and parses.
export const Mention = Node.create<MentionOptions>({
  name: 'mention',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: false,

  addOptions() {
    return { items: () => [] };
  },

  addAttributes() {
    return {
      username: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-mention') ?? '',
        renderHTML: (attributes) => ({ 'data-mention': attributes.username }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-mention]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const username = String(node.attrs.username);
    // The name behind the handle is only known while the roster is loaded, so it is
    // a tooltip rather than part of the chip.
    const name = this.options
      .items()
      .find((c) => c.username.toLowerCase() === username.toLowerCase())?.name;
    return [
      'span',
      mergeAttributes(HTMLAttributes, { class: 'mention', ...(name ? { title: name } : {}) }),
      `@${username}`,
    ];
  },

  renderText({ node }) {
    return `@${node.attrs.username}`;
  },

  addStorage() {
    return {
      markdown: {
        serialize(
          state: { write: (text: string) => void },
          node: { attrs: { username?: string } },
        ) {
          state.write(`@${node.attrs.username ?? ''}`);
        },
        parse: { updateDOM: markMentions },
      },
    };
  },

  addProseMirrorPlugins() {
    const { items } = this.options;
    return [
      Suggestion<MentionCandidate, MentionCandidate>({
        pluginKey: mentionPluginKey,
        editor: this.editor,
        char: '@',
        // Radix makes everything outside an open overlay inert, so the list mounts
        // inside the dialog the editor sits in.
        container: '[data-slot="dialog-content"]',
        items: ({ query }) => {
          const needle = query.toLowerCase();
          return items()
            .filter(
              (c) =>
                c.name.toLowerCase().includes(needle) || c.username.toLowerCase().includes(needle),
            )
            .slice(0, 8);
        },
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
          let component: ReactRenderer<MentionMenuRef> | null = null;
          let unmount: (() => void) | null = null;

          return {
            onStart: (props) => {
              component = new ReactRenderer(EditorMentionMenu, {
                props,
                editor: props.editor,
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
