import { MarkdownTaskList } from '@repo/editor';

// tiptap-markdown treats bullet and ordered lists as tight, but not task lists,
// so every task item would serialize with a blank line after it. Keep task lists
// tight as well, so `- [ ]` lines come back unchanged.
export const TightTaskList = MarkdownTaskList.extend({
  addGlobalAttributes() {
    return [
      {
        types: [this.name],
        attributes: {
          tight: {
            default: true,
            parseHTML: () => true,
            renderHTML: () => ({}),
          },
        },
      },
    ];
  },
});
