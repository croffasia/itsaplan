import type { Editor } from '@tiptap/react';
import { AlignCenter, AlignLeft, AlignRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import DocumentToolbarActions from './DocumentToolbarActions';
import DocumentToolbarGroup from './DocumentToolbarGroup';

export default function DocumentToolbarAlign({ editor }: { editor: Editor }) {
  const t = useTranslations('documents.toolbar');
  const chain = () => editor.chain().focus();

  return (
    <DocumentToolbarGroup>
      <DocumentToolbarActions
        actions={[
          {
            label: t('alignLeft'),
            icon: AlignLeft,
            active: editor.isActive({ textAlign: 'left' }),
            run: () => chain().setTextAlign('left').run(),
          },
          {
            label: t('alignCenter'),
            icon: AlignCenter,
            active: editor.isActive({ textAlign: 'center' }),
            run: () => chain().setTextAlign('center').run(),
          },
          {
            label: t('alignRight'),
            icon: AlignRight,
            active: editor.isActive({ textAlign: 'right' }),
            run: () => chain().setTextAlign('right').run(),
          },
        ]}
      />
    </DocumentToolbarGroup>
  );
}
