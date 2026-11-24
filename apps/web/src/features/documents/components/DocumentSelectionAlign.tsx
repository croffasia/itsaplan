import type { Editor } from '@tiptap/react';
import EditorToolbarButton from '@/components/common/editor/EditorToolbarButton';
import { useDocumentAlignActions } from '../hooks/useDocumentAlignActions';

export default function DocumentSelectionAlign({ editor }: { editor: Editor }) {
  const actions = useDocumentAlignActions(editor);
  return (
    <>
      <span className="mx-0.5 my-1 w-px self-stretch bg-border" aria-hidden />
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
