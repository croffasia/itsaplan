import Image from '@tiptap/extension-image';
import { ReactNodeViewRenderer } from '@tiptap/react';
import EditorResizableImage from './EditorResizableImage';

// Safe inside a double-quoted HTML attribute: a filename may hold any of these.
const escapeAttribute = (value: string) =>
  value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');

// The backslash is escaped alongside the delimiters: without it `a\)b` serializes
// as `a\\)b`, where the `)` is no longer escaped and ends the URL early.
function markdownImage(src: string, alt: string, title: string | null): string {
  const escapedAlt = alt.replaceAll(/[[\]\\]/g, '\\$&');
  const escapedSrc = src.replaceAll(/[\\()]/g, '\\$&');
  const escapedTitle = title ? ` "${title.replaceAll(/["\\]/g, '\\$&')}"` : '';
  return `![${escapedAlt}](${escapedSrc}${escapedTitle})`;
}

// Neither the width nor an embed's `style` fits `![](url)` syntax, so an image
// carrying either serializes as a raw <img> tag (tiptap-markdown runs html:true).
export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      // Kept so a raw <img style="max-width:50%"> keeps its sizing.
      style: { default: null },
      width: {
        default: null,
        parseHTML: (element) => {
          const width = Number.parseInt(element.getAttribute('width') ?? '', 10);
          return Number.isNaN(width) ? null : width;
        },
        renderHTML: (attributes) => (attributes.width ? { width: attributes.width } : {}),
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(EditorResizableImage);
  },

  addStorage() {
    return {
      markdown: {
        serialize(
          state: { write: (text: string) => void },
          node: {
            attrs: { src?: string; alt?: string; title?: string; width?: number; style?: string };
          },
        ) {
          const src = node.attrs.src ?? '';
          const alt = node.attrs.alt ?? '';
          const title = node.attrs.title ?? null;
          const { width, style } = node.attrs;
          if (!width && !style) {
            state.write(markdownImage(src, alt, title));
            return;
          }
          const titleAttribute = title ? ` title="${escapeAttribute(title)}"` : '';
          const widthAttribute = width ? ` width="${width}"` : '';
          const styleAttribute = style ? ` style="${escapeAttribute(style)}"` : '';
          state.write(
            `<img src="${escapeAttribute(src)}" alt="${escapeAttribute(alt)}"${titleAttribute}${widthAttribute}${styleAttribute}>`,
          );
        },
        parse: {},
      },
    };
  },
});
