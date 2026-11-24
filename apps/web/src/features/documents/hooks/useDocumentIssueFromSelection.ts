import type { Editor } from '@tiptap/react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { Issue } from '@/lib/api/endpoints/issues';
import { linkDocumentIssue } from '@/lib/api/endpoints/documents';
import { useShell } from '@/context/shellContext';
import { qk } from '@/services/queryKeys';
import { documentPath, issuePath } from '@/utils/paths';

// Opens the new work item dialog with the selected text. The created work item is linked
// to the page, and its key replaces the selection. The modal keeps the editor from
// taking input, and the editor maps its selection through edits from other people. The
// key goes in before the link request, since the selection can move once the modal closes.
export function useDocumentIssueFromSelection({
  editor,
  projectKey,
  documentId,
}: {
  editor: Editor;
  projectKey: string;
  documentId: number;
}) {
  const t = useTranslations('documents.workItem');
  const qc = useQueryClient();
  const { onAddIssue } = useShell();

  const linkToSelection = async (issue: Issue, quote: string) => {
    const key = `${projectKey}-${issue.sequenceNumber}`;
    if (!editor.isDestroyed && editor.isEditable) {
      const { from, to } = editor.state.selection;
      const unchanged = editor.state.doc.textBetween(from, to, '\n') === quote;
      editor
        .chain()
        .focus()
        .insertContentAt(
          { from: unchanged ? from : to, to },
          {
            type: 'text',
            text: key,
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
    try {
      await linkDocumentIssue(projectKey, documentId, issue.id);
    } catch {
      toast.error(t('linkFailed', { key }));
      return;
    }
    void qc.invalidateQueries({ queryKey: qk.documentIssueLinks(projectKey, documentId) });
    toast.success(t('created', { key }));
  };

  return (quote: string) => {
    const pageUrl = new URL(documentPath(projectKey, documentId), window.location.origin);
    onAddIssue(
      {
        title: quote.replace(/\s+/g, ' ').trim().slice(0, 255),
        description: `[${t('source')}](${pageUrl.toString()})\n\n${quote}`,
      },
      (issue) => void linkToSelection(issue, quote),
    );
  };
}
