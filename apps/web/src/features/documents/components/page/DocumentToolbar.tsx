'use client';

import { useEffect, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { MessageSquarePlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import DocumentBlockTypeMenu from './DocumentBlockTypeMenu';
import type { DocumentSelection } from '../DocumentSelectionActions';
import DocumentToolbarAlign from './DocumentToolbarAlign';
import DocumentToolbarBlocks from './DocumentToolbarBlocks';
import DocumentToolbarButton from './DocumentToolbarButton';
import DocumentToolbarGroup from './DocumentToolbarGroup';
import DocumentToolbarHistory from './DocumentToolbarHistory';
import DocumentToolbarText from './DocumentToolbarText';

const BAR =
  'flex h-12 min-w-0 shrink-0 [scrollbar-width:none] items-center overflow-x-auto ps-[calc(clamp(1rem,3vw,2.5rem)-0.5rem)] pe-3 [&::-webkit-scrollbar]:hidden';

export default function DocumentToolbar({
  editor,
  projectKey,
  documentId,
  canUpload,
  onComment,
}: {
  editor: Editor | null;
  projectKey: string;
  documentId: number;
  canUpload: boolean;
  onComment: (selection: DocumentSelection) => void;
}) {
  const t = useTranslations('documents.toolbar');
  const [, renderSelection] = useState(0);

  useEffect(() => {
    if (!editor) return;
    const refresh = () => renderSelection((revision) => revision + 1);
    editor.on('transaction', refresh);
    editor.on('selectionUpdate', refresh);
    return () => {
      editor.off('transaction', refresh);
      editor.off('selectionUpdate', refresh);
    };
  }, [editor]);

  if (!editor) {
    return (
      <div className={cn(BAR, 'gap-2')} aria-hidden>
        <div className="h-8 w-34 animate-pulse rounded-md bg-muted/60" />
        <div className="h-8 w-48 animate-pulse rounded-md bg-muted/40" />
      </div>
    );
  }

  return (
    <div className={BAR} role="toolbar" aria-label={t('label')}>
      <DocumentToolbarGroup>
        <DocumentBlockTypeMenu editor={editor} />
      </DocumentToolbarGroup>
      <DocumentToolbarText editor={editor} />
      <DocumentToolbarBlocks
        editor={editor}
        projectKey={projectKey}
        documentId={documentId}
        canUpload={canUpload}
      />
      <DocumentToolbarAlign editor={editor} />
      <DocumentToolbarHistory editor={editor} />
      <DocumentToolbarGroup end>
        <DocumentToolbarButton
          label={t('commentSelection')}
          disabled={editor.state.selection.empty}
          onClick={() => {
            const { from, to } = editor.state.selection;
            onComment({ from, to, quote: editor.state.doc.textBetween(from, to, '\n') });
          }}
        >
          <MessageSquarePlus />
        </DocumentToolbarButton>
      </DocumentToolbarGroup>
    </div>
  );
}
