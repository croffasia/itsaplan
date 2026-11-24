import { type Editor, useEditorState } from '@tiptap/react';
import { AlignCenter, AlignLeft, AlignRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { DocumentToolbarAction } from '../components/page/DocumentToolbarActions';

const ALIGNMENTS = [
  { value: 'left', label: 'alignLeft', icon: AlignLeft },
  { value: 'center', label: 'alignCenter', icon: AlignCenter },
  { value: 'right', label: 'alignRight', icon: AlignRight },
] as const;

export function useDocumentAlignActions(editor: Editor): DocumentToolbarAction[] {
  const t = useTranslations('documents.toolbar');
  const active = useEditorState({
    editor,
    selector: ({ editor: current }) =>
      ALIGNMENTS.map(({ value }) => current.isActive({ textAlign: value })),
  });
  return ALIGNMENTS.map(({ value, label, icon }, index) => ({
    label: t(label),
    icon,
    active: active[index],
    run: () => editor.chain().focus().setTextAlign(value).run(),
  }));
}
