import type { Editor } from '@tiptap/react';
import { Fragment, type Node as ProseMirrorNode } from '@tiptap/pm/model';
import { TextSelection } from '@tiptap/pm/state';
import { uuid } from '@/utils/uuid';

export function documentBlockRange(editor: Editor, position: number) {
  const doc = editor.state.doc;
  const resolved = doc.resolve(Math.max(0, Math.min(position, doc.content.size)));
  const from = resolved.depth ? resolved.before(1) : position;
  const node = doc.nodeAt(from);
  if (!node) return null;
  let to = from + node.nodeSize;
  if (node.type.name === 'heading') {
    while (to < doc.content.size) {
      const next = doc.nodeAt(to);
      if (!next || (next.type.name === 'heading' && next.attrs.level <= node.attrs.level)) break;
      to += next.nodeSize;
    }
  }
  return { from, to, node };
}
function copyNode(node: ProseMirrorNode): ProseMirrorNode {
  const children: ProseMirrorNode[] = [];
  node.content.forEach((child) => children.push(copyNode(child)));
  if (node.isText) return node;
  return node.type.create(
    node.attrs.blockId ? { ...node.attrs, blockId: uuid() } : node.attrs,
    Fragment.fromArray(children),
    node.marks,
  );
}
export function changeDocumentBlock(
  editor: Editor,
  position: number,
  action: 'duplicate' | 'delete' | 'up' | 'down',
) {
  if (!editor.isEditable) return false;
  const range = documentBlockRange(editor, position);
  if (!range) return false;
  const { from, to } = range;
  const doc = editor.state.doc;
  const tr = editor.state.tr;
  const content = doc.slice(from, to).content;
  let target = from;
  if (action === 'duplicate') {
    const nodes: ProseMirrorNode[] = [];
    content.forEach((node) => nodes.push(copyNode(node)));
    tr.insert(to, Fragment.fromArray(nodes));
    target = to;
  } else if (action === 'delete') tr.delete(from, to);
  else {
    const adjacent = action === 'up' ? doc.resolve(from).nodeBefore : doc.nodeAt(to);
    if (!adjacent) return false;
    target = action === 'up' ? from - adjacent.nodeSize : from + adjacent.nodeSize;
    if (range.node.type.name === 'heading') {
      if (action === 'up') {
        let previousHeading: number | null = null;
        doc.forEach((node, offset) => {
          if (
            offset < from &&
            node.type.name === 'heading' &&
            node.attrs.level <= range.node.attrs.level
          )
            previousHeading = node.attrs.level === range.node.attrs.level ? offset : null;
        });
        if (previousHeading !== null) target = previousHeading;
      } else if (
        adjacent.type.name === 'heading' &&
        adjacent.attrs.level === range.node.attrs.level
      ) {
        const nextSection = documentBlockRange(editor, to);
        if (nextSection) target = from + nextSection.to - to;
      }
    }
    tr.delete(from, to).insert(target, content);
  }
  tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(target + 1, tr.doc.content.size))));
  editor.view.dispatch(tr.scrollIntoView());
  editor.view.focus();
  return true;
}
