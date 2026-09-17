import { Extension } from '@tiptap/core';
import { ReplaceStep, ReplaceAroundStep } from '@tiptap/pm/transform';
import { Plugin } from '@tiptap/pm/state';
import { uuid } from '@/utils/uuid';

export const DOCUMENT_BLOCK_TYPES = [
  'paragraph',
  'heading',
  'blockquote',
  'codeBlock',
  'bulletList',
  'orderedList',
  'taskList',
  'table',
  'horizontalRule',
  'image',
];
export const DocumentBlockId = Extension.create({
  name: 'documentBlockId',
  addGlobalAttributes() {
    return [
      {
        types: DOCUMENT_BLOCK_TYPES,
        attributes: {
          blockId: {
            default: null,
            parseHTML: (element) => element.getAttribute('data-block-id'),
            renderHTML: (attributes) =>
              attributes.blockId
                ? { 'data-block-id': attributes.blockId, id: `block-${attributes.blockId}` }
                : {},
          },
        },
      },
    ];
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        appendTransaction: (transactions, _old, state) => {
          if (!this.editor.isEditable) return null;
          const structureChanged = transactions.some((tr) =>
            tr.steps.some((step) => {
              if (step instanceof ReplaceAroundStep) return true;
              if (!(step instanceof ReplaceStep)) return false;
              let hasBlocks = false;
              step.slice.content.forEach((node) => {
                if (!node.isText && !node.isInline) hasBlocks = true;
              });
              return hasBlocks;
            }),
          );
          if (!structureChanged) return null;
          const seen = new Set<string>();
          const tr = state.tr;
          state.doc.descendants((node, pos) => {
            if (!DOCUMENT_BLOCK_TYPES.includes(node.type.name)) return;
            const id = node.attrs.blockId as string | null;
            if (id && !seen.has(id)) {
              seen.add(id);
              return;
            }
            const next = uuid();
            seen.add(next);
            tr.setNodeMarkup(pos, undefined, { ...node.attrs, blockId: next });
          });
          return tr.docChanged ? tr.setMeta('addToHistory', false) : null;
        },
      }),
    ];
  },
});
