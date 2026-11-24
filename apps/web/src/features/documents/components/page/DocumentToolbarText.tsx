import type { Editor } from '@tiptap/react';
import { Bold, Code, Italic, Strikethrough, Underline } from 'lucide-react';
import { useTranslations } from 'next-intl';
import DocumentTextColorMenu from './DocumentTextColorMenu';
import DocumentToolbarActions from './DocumentToolbarActions';
import DocumentToolbarGroup from './DocumentToolbarGroup';

export default function DocumentToolbarText({ editor }: { editor: Editor }) {
  const t = useTranslations('documents.toolbar');
  const chain = () => editor.chain().focus();

  return (
    <DocumentToolbarGroup>
      <DocumentToolbarActions
        actions={[
          {
            label: t('bold'),
            icon: Bold,
            active: editor.isActive('bold'),
            run: () => chain().toggleBold().run(),
          },
          {
            label: t('italic'),
            icon: Italic,
            active: editor.isActive('italic'),
            run: () => chain().toggleItalic().run(),
          },
          {
            label: t('underline'),
            icon: Underline,
            active: editor.isActive('underline'),
            run: () => chain().toggleUnderline().run(),
          },
          {
            label: t('strike'),
            icon: Strikethrough,
            active: editor.isActive('strike'),
            run: () => chain().toggleStrike().run(),
          },
          {
            label: t('inlineCode'),
            icon: Code,
            active: editor.isActive('code'),
            run: () => chain().toggleCode().run(),
          },
        ]}
      />
      <DocumentTextColorMenu editor={editor} />
    </DocumentToolbarGroup>
  );
}
