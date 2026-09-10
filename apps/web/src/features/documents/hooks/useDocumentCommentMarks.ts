import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Editor } from '@tiptap/react';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Mapping } from '@tiptap/pm/transform';
import { sendableSteps } from 'prosemirror-collab';
import { listDocumentComments } from '@/lib/api/endpoints/documents';
import { qk } from '@/services/queryKeys';

const commentMarks = new PluginKey<DecorationSet>('documentCommentMarks');
export function useDocumentCommentMarks(
  editor: Editor | null,
  projectKey: string,
  documentId: number,
  onOpen: () => void,
  version: number,
) {
  const open = useRef(onOpen);
  open.current = onOpen;
  const { data } = useQuery({
    queryKey: qk.documentComments(projectKey, documentId),
    queryFn: () => listDocumentComments(projectKey, documentId),
  });
  useEffect(() => {
    if (!editor) return;
    editor.registerPlugin(
      new Plugin({
        key: commentMarks,
        state: {
          init: () => DecorationSet.empty,
          apply: (tr, previous) => tr.getMeta(commentMarks) ?? previous.map(tr.mapping, tr.doc),
        },
        props: {
          decorations: (state) => commentMarks.getState(state),
          handleClick: (_view, _pos, event) => {
            if (!(event.target instanceof Element)) return false;
            const id = event.target
              .closest('[data-document-comment]')
              ?.getAttribute('data-document-comment');
            if (!id) return false;
            open.current();
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
      return [
        Decoration.inline(from, to, {
          class: 'document-comment-mark',
          'data-document-comment': comment.id,
        }),
      ];
    });
    editor.view.dispatch(
      editor.state.tr.setMeta(commentMarks, DecorationSet.create(editor.state.doc, decorations)),
    );
  }, [data, editor, version]);
}
