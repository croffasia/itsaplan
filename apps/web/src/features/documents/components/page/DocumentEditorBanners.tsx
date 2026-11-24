import type { Editor } from '@tiptap/react';
import type { ProjectDocumentSummary } from '@/lib/api/endpoints/documents';
import { saveTextFile } from '@/utils/download';
import type { useDocumentCollaboration } from '../../hooks/useDocumentCollaboration';
import DocumentConflictBanner from './DocumentConflictBanner';
import DocumentReadOnlyBanner from './DocumentReadOnlyBanner';
import DocumentSyncBanner from './DocumentSyncBanner';

export default function DocumentEditorBanners({
  document,
  editor,
  title,
  canEdit,
  canManage,
  canManageLifecycle,
  busy,
  collaboration,
  conflict,
  onUnlock,
  onRestore,
  onDelete,
  onDiscard,
}: {
  document: ProjectDocumentSummary;
  editor: Editor | null;
  title: string;
  canEdit: boolean;
  canManage: boolean;
  canManageLifecycle: boolean;
  busy: boolean;
  // The editing session, when the page shows one.
  collaboration: ReturnType<typeof useDocumentCollaboration> | null;
  conflict: boolean;
  onUnlock: () => void;
  onRestore: () => void;
  onDelete: () => void;
  onDiscard: (kind: 'draft' | 'recovery') => void;
}) {
  return (
    <>
      <DocumentReadOnlyBanner
        document={document}
        canEdit={canEdit}
        canManage={canManage}
        canManageLifecycle={canManageLifecycle}
        busy={busy}
        onUnlock={onUnlock}
        onRestore={onRestore}
        onDelete={onDelete}
      />
      {collaboration && (
        <DocumentSyncBanner
          state={collaboration.status}
          onRetry={collaboration.retry}
          recoveryConflict={collaboration.recoveryConflict}
          onDiscardRecovery={() => onDiscard('recovery')}
          onExportRecovery={() => {
            if (!editor) return;
            saveTextFile(
              `${title || 'document'}-recovery.md`,
              editor.storage.markdown.getMarkdown(),
              'text/markdown;charset=utf-8',
            );
          }}
        />
      )}
      {conflict && <DocumentConflictBanner onReview={() => onDiscard('draft')} />}
    </>
  );
}
