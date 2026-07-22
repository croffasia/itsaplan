import { Node, mergeAttributes } from '@tiptap/core';

// A block node that renders an inline HTML5 <video> player in the editor and
// round-trips through markdown as a raw <video src="…" controls></video> tag.
// Markdown has no native video syntax, so attachments of type video/* are
// embedded with this node instead of a plain link. Requires the editor's
// tiptap-markdown to run with html:true so the tag survives serialization; on
// load parseHTML reconstructs the node from the same tag.
export const Video = Node.create({
  name: 'video',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: { default: null },
      title: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'video[src]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      // max-width:50% keeps the (usually vertical) reel from dominating the
      // issue — about half the on-screen size of a full-width embed.
      'video',
      mergeAttributes(HTMLAttributes, {
        controls: 'true',
        preload: 'metadata',
        style: 'max-width:50%;border-radius:6px',
      }),
    ];
  },

  addStorage() {
    return {
      markdown: {
        serialize(
          state: { write: (text: string) => void; closeBlock: (node: unknown) => void },
          node: { attrs: { src?: string; title?: string } },
        ) {
          const src = node.attrs.src ?? '';
          const title = node.attrs.title ? ` title="${node.attrs.title}"` : '';
          state.write(`<video src="${src}"${title} controls></video>`);
          state.closeBlock(node);
        },
        parse: {},
      },
    };
  },
});
