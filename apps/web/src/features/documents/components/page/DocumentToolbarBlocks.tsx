import type { Editor } from '@tiptap/react';
import { List, ListOrdered, Minus, Quote, SquareCheck, SquareCode, Table } from 'lucide-react';
import { useTranslations } from 'next-intl';
import DocumentImageMenu from './DocumentImageMenu';
import DocumentToolbarActions from './DocumentToolbarActions';
import DocumentToolbarGroup from './DocumentToolbarGroup';

export default function DocumentToolbarBlocks({
  editor,
  projectKey,
  documentId,
  canUpload,
}: {
  editor: Editor;
  projectKey: string;
  documentId: number;
  canUpload: boolean;
}) {
  const t = useTranslations('documents.toolbar');
  const chain = () => editor.chain().focus();

  return (
    <DocumentToolbarGroup>
      <DocumentToolbarActions
        actions={[
          {
            label: t('bulletList'),
            icon: List,
            active: editor.isActive('bulletList'),
            run: () => chain().toggleBulletList().run(),
          },
          {
            label: t('numberedList'),
            icon: ListOrdered,
            active: editor.isActive('orderedList'),
            run: () => chain().toggleOrderedList().run(),
          },
          {
            label: t('todoList'),
            icon: SquareCheck,
            active: editor.isActive('taskList'),
            run: () => chain().toggleTaskList().run(),
          },
          {
            label: t('quote'),
            icon: Quote,
            active: editor.isActive('blockquote'),
            run: () => chain().toggleBlockquote().run(),
          },
          {
            label: t('codeBlock'),
            icon: SquareCode,
            active: editor.isActive('codeBlock'),
            run: () => chain().toggleCodeBlock().run(),
          },
          { label: t('divider'), icon: Minus, run: () => chain().setHorizontalRule().run() },
          {
            label: t('table'),
            icon: Table,
            active: editor.isActive('table'),
            run: () => {
              if (editor.isActive('table')) chain().deleteTable().run();
              else chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
            },
          },
        ]}
      />
      <DocumentImageMenu
        editor={editor}
        projectKey={projectKey}
        documentId={documentId}
        canUpload={canUpload}
      />
    </DocumentToolbarGroup>
  );
}
