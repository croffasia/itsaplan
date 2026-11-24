import { useEffect, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { ListPlus, MessageSquarePlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { usePermissions } from '@/hooks/usePermissions';
import { useDocumentIssueFromSelection } from '../hooks/useDocumentIssueFromSelection';
import DocumentSelectionDivider from './DocumentSelectionDivider';

export type DocumentSelection = { from: number; to: number; quote: string; version?: number };

const ACTION =
  'inline-flex h-7.5 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium transition-colors hover:bg-accent [&_svg]:size-3.5 [&_svg]:text-muted-foreground';

export default function DocumentSelectionActions({
  editor,
  projectKey,
  documentId,
  onComment,
}: {
  editor: Editor;
  projectKey: string;
  documentId: number;
  onComment: (selection: DocumentSelection) => void;
}) {
  const t = useTranslations('documents');
  const { can } = usePermissions();
  const [selection, setSelection] = useState<DocumentSelection | null>(null);
  const createIssue = useDocumentIssueFromSelection({ editor, projectKey, documentId });
  useEffect(() => {
    const update = () => {
      const { from, to, empty } = editor.state.selection;
      const quote = editor.state.doc.textBetween(from, to, '\n');
      setSelection(!empty && quote.trim() ? { from, to, quote } : null);
    };
    editor.on('selectionUpdate', update);
    update();
    return () => {
      editor.off('selectionUpdate', update);
    };
  }, [editor]);
  if (!selection || !editor.isEditable) return null;
  return (
    <>
      <DocumentSelectionDivider />
      <div
        className="flex items-center gap-0.5 print:hidden"
        role="group"
        aria-label={t('selectionActions')}
      >
        <button
          type="button"
          className={ACTION}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onComment(selection)}
        >
          <MessageSquarePlus />
          {t('comments.add')}
        </button>
        {can('work_items', 'create') && can('work_items', 'edit') && (
          <button
            type="button"
            className={ACTION}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => createIssue(selection.quote)}
          >
            <ListPlus />
            {t('workItem.create')}
          </button>
        )}
      </div>
    </>
  );
}
