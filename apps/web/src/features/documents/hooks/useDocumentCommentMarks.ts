import { useEffect, useRef } from 'react';
import type { Editor } from '@tiptap/react';
import type { Node } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Mapping } from '@tiptap/pm/transform';
import { sendableSteps } from 'prosemirror-collab';
import { useDocumentCommentsQuery } from '../services/documents.service';

type MarksState = { marks: DecorationSet; active: string | null; shown: DecorationSet };
type MarksMeta = { marks?: DecorationSet; active?: string | null };

const commentMarks = new PluginKey<MarksState>('documentCommentMarks');
const MARK = 'document-comment-mark';

function mark(from: number, to: number, id: string, active: boolean) {
  return Decoration.inline(
    from,
    to,
    { class: active ? `${MARK} ${MARK}-active` : MARK, 'data-document-comment': id },
    { id },
  );
}

function withActive(marks: DecorationSet, active: string | null, doc: Node) {
  if (!active) return marks;
  const found = marks.find(undefined, undefined, (spec) => spec.id === active);
  if (!found.length) return marks;
  // remove() empties the array it is given, so the highlighted copies are made first.
  const highlighted = found.map((decoration) => mark(decoration.from, decoration.to, active, true));
  return marks.remove(found).add(doc, highlighted);
}

// Draws the open threads over the text they quote and highlights `activeId`'s. A
// collaborative session replaces the editor's content when it opens, which drops the
// marks, so they are drawn again once sessionReady turns true.
export function useDocumentCommentMarks(
  editor: Editor | null,
  projectKey: string,
  documentId: number,
  onOpen: (commentId: string) => void,
  version: number,
  sessionReady: boolean,
  activeId: string | null = null,
) {
  const open = useRef(onOpen);
  open.current = onOpen;
  const { data } = useDocumentCommentsQuery(projectKey, documentId);
  useEffect(() => {
    if (!editor) return;
    editor.registerPlugin(
      new Plugin<MarksState>({
        key: commentMarks,
        state: {
          init: () => ({ marks: DecorationSet.empty, active: null, shown: DecorationSet.empty }),
          apply: (tr, previous) => {
            const meta = tr.getMeta(commentMarks) as MarksMeta | undefined;
            if (!meta)
              return {
                ...previous,
                marks: previous.marks.map(tr.mapping, tr.doc),
                shown: previous.shown.map(tr.mapping, tr.doc),
              };
            const marks = meta.marks ?? previous.marks.map(tr.mapping, tr.doc);
            const active = meta.active !== undefined ? meta.active : previous.active;
            return { marks, active, shown: withActive(marks, active, tr.doc) };
          },
        },
        props: {
          decorations: (state) => commentMarks.getState(state)?.shown,
          handleClick: (_view, _pos, event) => {
            if (!(event.target instanceof Element)) return false;
            const id = event.target
              .closest('[data-document-comment]')
              ?.getAttribute('data-document-comment');
            if (!id) return false;
            open.current(id);
            requestAnimationFrame(() =>
              window.document
                .getElementById(`document-comment-${id}`)
                ?.scrollIntoView({ block: 'nearest' }),
            );
            return true;
          },
        },
      }),
    );
    return () => {
      if (!editor.isDestroyed) editor.unregisterPlugin(commentMarks);
    };
  }, [editor]);
  useEffect(() => {
    if (!editor || editor.isDestroyed || !data) return;
    if (data.length && data[0].documentVersion !== version) return;
    const mapping = new Mapping();
    try {
      sendableSteps(editor.state)?.steps.forEach((step) => mapping.appendMap(step.getMap()));
    } catch {
      /* Read-only editors have no collaboration plugin. */
    }
    const decorations = data.flatMap((comment) => {
      if (
        comment.parentId ||
        comment.resolvedAt ||
        comment.orphaned ||
        comment.from === null ||
        comment.to === null
      )
        return [];
      const from = mapping.map(comment.from, 1),
        to = mapping.map(comment.to, -1);
      if (from >= to || from < 0 || to > editor.state.doc.content.size) return [];
      return [mark(from, to, comment.id, false)];
    });
    editor.view.dispatch(
      editor.state.tr.setMeta(commentMarks, {
        marks: DecorationSet.create(editor.state.doc, decorations),
      } satisfies MarksMeta),
    );
  }, [data, editor, version, sessionReady]);
  useEffect(() => {
    highlightCommentMark(editor, activeId);
  }, [editor, activeId, sessionReady]);
}

// Highlights one thread's text in the editor, or none. The comments panel calls it
// while the pointer is over a thread.
export function highlightCommentMark(editor: Editor | null, commentId: string | null) {
  if (!editor || editor.isDestroyed) return;
  editor.view.dispatch(
    editor.state.tr.setMeta(commentMarks, { active: commentId } satisfies MarksMeta),
  );
}
