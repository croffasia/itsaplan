import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import type { SelectionBookmark } from '@tiptap/pm/state';
import { ListPlus, MessageSquarePlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import DocumentCreateIssueDialog from './DocumentCreateIssueDialog';

export type DocumentSelection = { from: number; to: number; quote: string; version?: number };
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
  const [creating, setCreating] = useState(false);
  const bookmark = useRef<SelectionBookmark>(editor.state.selection.getBookmark());
  useEffect(() => {
    const update = () => {
      if (creating) return;
      const { from, to, empty } = editor.state.selection;
      const quote = editor.state.doc.textBetween(from, to, '\n');
      setSelection(!empty && quote.trim() ? { from, to, quote } : null);
      bookmark.current = editor.state.selection.getBookmark();
    };
    const map = ({
      transaction,
    }: {
      transaction: { mapping: Parameters<SelectionBookmark['map']>[0] };
    }) => {
      if (creating) bookmark.current = bookmark.current.map(transaction.mapping);
    };
    editor.on('selectionUpdate', update);
    editor.on('transaction', map);
    update();
    return () => {
      editor.off('selectionUpdate', update);
      editor.off('transaction', map);
    };
  }, [creating, editor]);
  if (!selection || !editor.isEditable) return null;
  return (
    <>
      <div
        className="ms-1 flex items-center gap-1 border-s ps-1 print:hidden"
        role="toolbar"
        aria-label={t('selectionActions')}
      >
        <Button
          size="sm"
          variant="ghost"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onComment(selection)}
        >
          <MessageSquarePlus className="size-4" />
          {t('comments.add')}
        </Button>
        {can('work_items', 'create') && can('work_items', 'edit') && (
          <Button
            size="sm"
            variant="ghost"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setCreating(true)}
          >
            <ListPlus className="size-4" />
            {t('workItem.create')}
          </Button>
        )}
      </div>
      {creating && (
        <DocumentCreateIssueDialog
          editor={editor}
          projectKey={projectKey}
          documentId={documentId}
          quote={selection.quote}
          bookmark={bookmark}
          onClose={() => setCreating(false)}
        />
      )}
    </>
  );
}
