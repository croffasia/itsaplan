import { getHTMLFromFragment } from '@tiptap/core';
import Heading from '@tiptap/extension-heading';
import Paragraph from '@tiptap/extension-paragraph';
import { Fragment, type Node as ProseMirrorNode } from '@tiptap/pm/model';
import { defaultMarkdownSerializer } from 'prosemirror-markdown';
import type { MarkdownState } from './markdown-state';

type Serialize = (
  state: MarkdownState,
  node: ProseMirrorNode,
  parent: ProseMirrorNode,
  index: number,
) => void;

// Markdown has no alignment, so an aligned block is written as raw HTML, which keeps it.
function alignedOr(serialize: Serialize): Serialize {
  return (state, node, parent, index) => {
    if (!node.attrs.textAlign) return serialize(state, node, parent, index);
    state.write(getHTMLFromFragment(Fragment.from(node), node.type.schema));
    state.closeBlock(node);
  };
}

export const AlignedParagraph = Paragraph.extend({
  addStorage() {
    return {
      markdown: {
        serialize: alignedOr(defaultMarkdownSerializer.nodes.paragraph as unknown as Serialize),
      },
    };
  },
});

export const AlignedHeading = Heading.extend({
  addStorage() {
    return {
      markdown: {
        serialize: alignedOr(defaultMarkdownSerializer.nodes.heading as unknown as Serialize),
      },
    };
  },
});
