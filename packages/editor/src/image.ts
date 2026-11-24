import Image, { type ImageOptions } from '@tiptap/extension-image';
import { allowedImageStyle, imageWidth } from './rules';
import type { MarkdownState } from './markdown-state';

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

export type MarkdownImageOptions = ImageOptions & {
  // An image whose src fails it is not read from HTML or Markdown.
  isAllowedSrc: (src: string) => boolean;
};

// Neither the width nor an embed's `style` fits `![](url)` syntax, so an image
// carrying either serializes as a raw <img> tag (tiptap-markdown runs html:true).
export const MarkdownImage = Image.extend<MarkdownImageOptions>({
  addOptions() {
    return { ...this.parent!(), isAllowedSrc: () => true };
  },

  parseHTML() {
    return (this.parent?.() ?? []).map((rule) => ({
      ...rule,
      getAttrs: (element: HTMLElement) => {
        const src = element.getAttribute('src');
        return src && this.options.isAllowedSrc(src) ? null : false;
      },
    }));
  },

  addAttributes() {
    // The image keeps height:auto and nothing ever sets the inherited height, so
    // it is dropped: it would otherwise reach the document JSON as `height: null`,
    // which the API rejects as an unsupported image attr.
    const { height: _height, ...parent }: Record<string, unknown> = this.parent?.() ?? {};
    return {
      ...parent,
      // Kept so a raw <img style="max-width:50%"> keeps its sizing.
      style: {
        default: null,
        parseHTML: (element) => allowedImageStyle(element.getAttribute('style')),
      },
      width: {
        default: null,
        parseHTML: (element) => imageWidth(element.getAttribute('width')),
        renderHTML: (attributes) => (attributes.width ? { width: attributes.width } : {}),
      },
    };
  },

  addStorage() {
    return {
      markdown: {
        serialize(
          state: MarkdownState,
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
