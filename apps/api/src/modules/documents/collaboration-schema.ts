import { Schema, type NodeSpec } from '@tiptap/pm/model';

const blockId = { default: null };
const block = { blockId };
const aligned = { ...block, textAlign: { default: null } };
const cell = {
  colspan: { default: 1 },
  rowspan: { default: 1 },
  colwidth: { default: null },
  align: { default: null },
};
const nodes: Record<string, NodeSpec> = {
  doc: { content: 'block+' },
  text: { group: 'inline' },
  paragraph: { group: 'block', content: 'inline*', attrs: aligned },
  heading: {
    group: 'block',
    content: 'inline*',
    attrs: { ...aligned, level: { default: 1 } },
    defining: true,
  },
  blockquote: { group: 'block', content: 'block+', attrs: block, defining: true },
  bulletList: {
    group: 'block list',
    content: 'listItem+',
    attrs: { ...block, tight: { default: true } },
  },
  orderedList: {
    group: 'block list',
    content: 'listItem+',
    attrs: { ...block, tight: { default: true }, start: { default: 1 }, type: { default: null } },
  },
  listItem: { content: 'paragraph block*', defining: true },
  taskList: { group: 'block list', content: 'taskItem+', attrs: block },
  taskItem: { content: 'paragraph block*', defining: true, attrs: { checked: { default: false } } },
  horizontalRule: { group: 'block', attrs: block },
  hardBreak: { group: 'inline', inline: true, selectable: false },
  codeBlock: {
    group: 'block',
    content: 'text*',
    marks: '',
    code: true,
    defining: true,
    attrs: { ...block, language: { default: null } },
  },
  image: {
    group: 'block',
    atom: true,
    attrs: {
      ...block,
      src: { default: null },
      alt: { default: null },
      title: { default: null },
      width: { default: null },
      style: { default: null },
    },
  },
  table: { group: 'block', content: 'tableRow+', isolating: true, attrs: block },
  tableRow: { content: '(tableCell | tableHeader)*' },
  tableCell: { content: 'block+', isolating: true, attrs: cell },
  tableHeader: { content: 'block+', isolating: true, attrs: cell },
};
export const collaborationSchema = new Schema({
  nodes,
  marks: {
    bold: {},
    italic: {},
    strike: {},
    underline: {},
    code: { excludes: '_' },
    link: {
      inclusive: false,
      attrs: {
        href: { default: null },
        title: { default: null },
        target: { default: '_blank' },
        rel: { default: 'noopener noreferrer nofollow' },
        class: { default: null },
      },
    },
    textStyle: { attrs: { color: { default: null } } },
    highlight: { attrs: { color: { default: null } } },
  },
});
