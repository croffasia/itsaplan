import { Node, mergeAttributes } from '@tiptap/core';
import { MENTION_RE, isMentionHandle } from './rules';
import type { MarkdownState } from './markdown-state';

const SHOW_TEXT = 4;

// Rebuilds one text node as a run of text and mention elements. Returns null when
// the text holds no mention, so the caller leaves the node alone.
function mentionFragment(text: Text): DocumentFragment | null {
  const matches = [...text.data.matchAll(MENTION_RE)];
  if (matches.length === 0) return null;
  const document = text.ownerDocument;
  const fragment = document.createDocumentFragment();
  let cursor = 0;
  for (const match of matches) {
    if (match.index > cursor) fragment.append(text.data.slice(cursor, match.index));
    const element = document.createElement('span');
    element.setAttribute('data-mention', match[1]!);
    fragment.append(element);
    cursor = match.index + match[0].length;
  }
  if (cursor < text.data.length) fragment.append(text.data.slice(cursor));
  return fragment;
}

// Turns every @handle in the markdown-rendered HTML into a mention element, so the
// editor reads it back as a node. Code and links are left as written: an @ in them
// is part of the code or the URL.
export function markMentions(root: Element) {
  const walker = root.ownerDocument.createTreeWalker(root, SHOW_TEXT);
  const texts: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node as Text;
    if (text.data.includes('@') && !text.parentElement?.closest('code, pre, a')) texts.push(text);
  }
  for (const text of texts) {
    const fragment = mentionFragment(text);
    if (fragment) text.replaceWith(fragment);
  }
}

// A mention is its own inline node so it reads as one chip: the caret steps over it
// and a delete removes the whole handle. It serializes back to plain @handle, which
// is what the api stores and parses. The editor extends it with the "@" menu.
export const MentionNode = Node.create({
  name: 'mention',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: false,

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
    return [
      {
        tag: 'span[data-mention]',
        getAttrs: (element: HTMLElement) =>
          isMentionHandle(element.getAttribute('data-mention')) ? null : false,
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, { class: 'mention' }),
      `@${String(node.attrs.username)}`,
    ];
  },

  renderText({ node }) {
    return `@${node.attrs.username}`;
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: MarkdownState, node: { attrs: { username?: string } }) {
          state.write(`@${node.attrs.username ?? ''}`);
        },
        parse: { updateDOM: markMentions },
      },
    };
  },
});
