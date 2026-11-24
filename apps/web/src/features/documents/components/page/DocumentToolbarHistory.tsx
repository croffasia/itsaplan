import type { Editor } from '@tiptap/react';
import { Redo2, Undo2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import DocumentToolbarButton from './DocumentToolbarButton';
import DocumentToolbarGroup from './DocumentToolbarGroup';

export default function DocumentToolbarHistory({ editor }: { editor: Editor }) {
  const t = useTranslations('documents.toolbar');

  return (
    <DocumentToolbarGroup>
      <DocumentToolbarButton
        label={t('undo')}
        disabled={!editor.can().chain().focus().undo().run()}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <Undo2 />
      </DocumentToolbarButton>
      <DocumentToolbarButton
        label={t('redo')}
        disabled={!editor.can().chain().focus().redo().run()}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <Redo2 />
      </DocumentToolbarButton>
    </DocumentToolbarGroup>
  );
}
