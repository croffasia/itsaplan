import Highlight from '@tiptap/extension-highlight';
import { Color } from '@tiptap/extension-text-style';
import { documentColor } from './rules';

// A property of the inline style as written, before the browser rewrites it.
function styleProperty(element: HTMLElement, name: string): string | null {
  for (const declaration of (element.getAttribute('style') ?? '').split(';')) {
    const colon = declaration.indexOf(':');
    if (colon !== -1 && declaration.slice(0, colon).trim().toLowerCase() === name)
      return declaration.slice(colon + 1);
  }
  return null;
}

// Text colour, read as hex (rules.documentColor).
export const DocumentColor = Color.extend({
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          color: {
            default: null,
            parseHTML: (element) => documentColor(styleProperty(element, 'color')),
            renderHTML: (attributes) =>
              attributes.color ? { style: `color: ${attributes.color}` } : {},
          },
        },
      },
    ];
  },
});

// Highlight colour, read as hex. A <mark> with no colour has none.
export const DocumentHighlight = Highlight.extend({
  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (element) =>
          documentColor(
            element.getAttribute('data-color') || styleProperty(element, 'background-color'),
          ),
        renderHTML: (attributes) =>
          attributes.color
            ? {
                'data-color': attributes.color,
                style: `background-color: ${attributes.color}; color: inherit`,
              }
            : {},
      },
    };
  },
});
