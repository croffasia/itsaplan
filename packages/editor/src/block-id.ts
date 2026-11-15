import { Extension } from '@tiptap/core';
import { DOCUMENT_BLOCK_TYPES, isBlockId } from './rules';

// The blockId attribute of a page's blocks. The editor extends it with the plugin that
// gives a new block its id.
export const BlockId = Extension.create({
  name: 'documentBlockId',
  addGlobalAttributes() {
    return [
      {
        types: DOCUMENT_BLOCK_TYPES,
        attributes: {
          blockId: {
            default: null,
            parseHTML: (element) => {
              const id = element.getAttribute('data-block-id');
              return isBlockId(id) ? id : null;
            },
            renderHTML: (attributes) =>
              attributes.blockId
                ? { 'data-block-id': attributes.blockId, id: `block-${attributes.blockId}` }
                : {},
          },
        },
      },
    ];
  },
});
