import type { Editor } from '@tiptap/react';
import EditorToolbarButton from '@/components/common/editor/EditorToolbarButton';
import { useDocumentAlignActions } from '../hooks/useDocumentAlignActions';
import DocumentSelectionDivider from './DocumentSelectionDivider';

export default function DocumentSelectionAlign({ editor }: { editor: Editor }) {
  const actions = useDocumentAlignActions(editor);
  return (
    <>
      <DocumentSelectionDivider />
      {actions.map((action) => (
        <EditorToolbarButton
          key={action.label}
          title={action.label}
          active={action.active}
          onClick={action.run}
        >
          <action.icon />
        </EditorToolbarButton>
      ))}
    </>
  );
}
