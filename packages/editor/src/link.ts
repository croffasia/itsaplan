import type { Attributes } from '@tiptap/core';
import { Link } from '@tiptap/extension-link';

// A link read from HTML keeps its address and title. Its target, rel and class are the
// editor's own, so a page never holds values the api refuses.
export const DocumentLink = Link.extend({
  addAttributes() {
    const parent = this.parent!() as Attributes;
    const own = (name: 'target' | 'rel' | 'class') => ({ ...parent[name], parseHTML: () => null });
    return { ...parent, target: own('target'), rel: own('rel'), class: own('class') };
  },
});
