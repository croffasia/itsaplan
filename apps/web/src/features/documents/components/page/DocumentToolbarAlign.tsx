import type { Editor } from '@tiptap/react';
import { useDocumentAlignActions } from '../../hooks/useDocumentAlignActions';
import DocumentToolbarActions from './DocumentToolbarActions';
import DocumentToolbarGroup from './DocumentToolbarGroup';

export default function DocumentToolbarAlign({ editor }: { editor: Editor }) {
  const actions = useDocumentAlignActions(editor);
  return (
    <DocumentToolbarGroup>
      <DocumentToolbarActions actions={actions} />
    </DocumentToolbarGroup>
  );
}
