import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Editor } from '@tiptap/react';
import type { SelectionBookmark } from '@tiptap/pm/state';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { type Issue, createIssue } from '@/lib/api/endpoints/issues';
import { listDocumentIssueLinks, linkDocumentIssue } from '@/lib/api/endpoints/documents';
import { qk } from '@/services/queryKeys';
import { documentPath, issuePath } from '@/utils/paths';

// Creates a work item from the selected text, links it to the page and puts its key in
// place of the selection. The work item is created once: when linking fails, `create`
// only retries the link.
export function useDocumentIssueFromSelection({
  editor,
  projectKey,
  documentId,
  quote,
  bookmark,
  onDone,
}: {
  editor: Editor;
  projectKey: string;
  documentId: number;
  quote: string;
  bookmark: { current: SelectionBookmark };
  onDone: () => void;
}) {
  const t = useTranslations('documents.workItem');
  const qc = useQueryClient();
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState(false);
  const created = useRef<Issue | null>(null);

  const create = async (title: string, columnId: number) => {
    if (pending) return;
    setPending(true);
    setFailure(false);
    try {
      if (!created.current)
        created.current = await createIssue(projectKey, {
          title,
          columnId,
          description: `[${t('source')}](${new URL(documentPath(projectKey, documentId), window.location.origin).toString()})\n\n${quote}`,
        });
      const issue = created.current;
      const links = await listDocumentIssueLinks(projectKey, documentId);
      if (!links.some((link) => link.issueId === issue.id))
        await linkDocumentIssue(projectKey, documentId, issue.id);
      if (!editor.isDestroyed && editor.isEditable) {
        const selection = bookmark.current.resolve(editor.state.doc);
        const unchanged =
          editor.state.doc.textBetween(selection.from, selection.to, '\n') === quote;
        const from = unchanged ? selection.from : selection.to;
        editor
          .chain()
          .focus()
          .insertContentAt(
            { from, to: selection.to },
            {
              type: 'text',
              text: `${projectKey}-${issue.sequenceNumber}`,
              marks: [
                {
                  type: 'link',
                  attrs: {
                    href: issuePath(projectKey, issue.sequenceNumber),
                    class: 'document-issue-link',
                  },
                },
              ],
            },
          )
          .run();
      }
      void qc.invalidateQueries({ queryKey: qk.documentIssueLinks(projectKey, documentId) });
      void qc.invalidateQueries({ queryKey: qk.boardIssues(projectKey) });
      toast.success(t('created', { key: `${projectKey}-${issue.sequenceNumber}` }));
      onDone();
    } catch {
      setFailure(true);
    } finally {
      setPending(false);
    }
  };

  return { create, pending, failure, created: created.current !== null };
}
