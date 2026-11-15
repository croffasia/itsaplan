import { getHTMLFromFragment } from '@tiptap/core';
import { Table } from '@tiptap/extension-table';
import { Fragment, type Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { MarkdownState } from './markdown-state';

// A pipe table carries a header row and one block per cell. A table with merged
// cells or a cell holding two paragraphs has no markdown form, so it is written as
// raw HTML instead (the editor runs tiptap-markdown with html:true).
function isPipeTable(table: ProseMirrorNode): boolean {
  let plain = true;
  table.forEach((row, _offset, rowIndex) => {
    row.forEach((cell) => {
      const isHeaderCell = cell.type.name === 'tableHeader';
      const inHeaderRow = rowIndex === 0;
      if (
        isHeaderCell !== inHeaderRow ||
        cell.attrs.colspan > 1 ||
        cell.attrs.rowspan > 1 ||
        cell.childCount > 1
      ) {
        plain = false;
      }
    });
  });
  return plain;
}

// A "|" in a cell — typed as text, inside inline code, or part of a link URL —
// would end the cell when the markdown is read back, so every pipe the cell wrote
// is escaped. It is escaped after the fact rather than before: the serializer
// escapes a backslash of its own, which would turn "\|" into a literal backslash.
function writeCell(state: MarkdownState, content: ProseMirrorNode) {
  const start = state.out.length;
  state.renderInline(content);
  state.out = state.out.slice(0, start) + state.out.slice(start).replaceAll('|', '\\|');
}

const ALIGNMENT_RULE: Record<string, string> = { left: ':---', center: ':---:', right: '---:' };

// tiptap-markdown serializes a table itself, but writes each cell's content
// unescaped. This replaces its serializer with one that escapes the pipes.
export const MarkdownTable = Table.extend({
  addStorage() {
    return {
      markdown: {
        serialize(state: MarkdownState, node: ProseMirrorNode) {
          if (!isPipeTable(node)) {
            state.write(getHTMLFromFragment(Fragment.from(node), node.type.schema));
            state.closeBlock(node);
            return;
          }
          state.inTable = true;
          node.forEach((row, _offset, rowIndex) => {
            state.write('| ');
            row.forEach((cell, _cellOffset, column) => {
              if (column) state.write(' | ');
              // A cell that holds only a mention has no text but still has content.
              const content = cell.firstChild;
              if (content?.childCount) writeCell(state, content);
            });
            state.write(' |');
            state.ensureNewLine();
            if (rowIndex === 0) {
              const rules: string[] = [];
              row.forEach((cell) => rules.push(ALIGNMENT_RULE[cell.attrs.align] ?? '---'));
              state.write(`|${rules.map((rule) => ` ${rule} |`).join('')}`);
              state.ensureNewLine();
            }
          });
          state.closeBlock(node);
          state.inTable = false;
        },
        parse: {},
      },
    };
  },
});
