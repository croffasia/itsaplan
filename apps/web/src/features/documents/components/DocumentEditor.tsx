'use client';

import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import type { ProjectDocument, ProjectDocumentSummary } from '@/lib/api/endpoints/documents';
import { useRelativeTime } from '@/context/relativeTimeContext';
import { useSession } from '@/lib/auth-client';
import { useTranslations } from 'next-intl';
import { useDocumentCommentMarks } from '../hooks/useDocumentCommentMarks';
import { useDocumentCollaboration } from '../hooks/useDocumentCollaboration';
import DocumentCommentsPanel from './DocumentCommentsPanel';
import type { DocumentSelection } from './DocumentSelectionActions';
import DocumentSyncBanner from './DocumentSyncBanner';
import { useDocumentDraft } from '../hooks/useDocumentDraft';
import { useDocumentActionGate } from '../hooks/useDocumentActionGate';
import { useDocumentEditorPreferences } from '../hooks/useDocumentEditorPreferences';
import {
  useArchiveDocument,
  useRestoreDocument,
  useSetDocumentAccess,
  useSetDocumentFavorite,
  useSetDocumentLocked,
  useUploadDocumentAsset,
  useUpdateDocument,
} from '../services/documents.service';
import DocumentConflictBanner from './DocumentConflictBanner';
import DocumentDeleteDialog from './DocumentDeleteDialog';
import DocumentDiscardDraftDialog from './DocumentDiscardDraftDialog';
import DocumentEditorCanvas from './DocumentEditorCanvas';
import DocumentEditorHeader from './DocumentEditorHeader';
import DocumentEditorInspector from './DocumentEditorInspector';
import DocumentHistoryDialog from './DocumentHistoryDialog';

export default function DocumentEditor({
  projectKey,
  projectName,
  document,
  ancestors,
  authorName,
  authorNames,
  canEdit,
  canReadWorkItems,
  canLinkWorkItems,
  isProjectOwner,
  canCreate,
  canDelete,
  onBack,
  onCreateChild,
  onDuplicate,
  onDelete,
  onReload,
}: {
  projectKey: string;
  projectName: string;
  document: ProjectDocument;
  ancestors: ProjectDocumentSummary[];
  authorName: string | null;
  authorNames: Record<string, string>;
  canEdit: boolean;
  canReadWorkItems: boolean;
  canLinkWorkItems: boolean;
  isProjectOwner: boolean;
  canCreate: boolean;
  canDelete: boolean;
  onBack: () => void;
  onCreateChild: () => void;
  onDuplicate: (title: string, version: number) => Promise<void>;
  onDelete: (version: number) => Promise<void>;
  onReload: () => Promise<ProjectDocument | null>;
}) {
  const t = useTranslations('documents');
  const { data: session } = useSession();
  const relativeTime = useRelativeTime();
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentSelection, setCommentSelection] = useState<DocumentSelection | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const documentAction = useDocumentActionGate();
  const currentUserId = session?.user.id ?? null;
  const editable =
    canEdit && currentUserId !== null && !document.isLocked && document.archivedAt === null;
  const editorEditable = editable && !documentAction.pending;
  const canManage =
    canEdit && currentUserId !== null && (isProjectOwner || document.ownerUserId === currentUserId);
  const canManageLifecycle =
    canDelete &&
    currentUserId !== null &&
    (isProjectOwner || document.ownerUserId === currentUserId);
  const { stickyToolbar, setStickyToolbar } = useDocumentEditorPreferences();
  const updateDocument = useUpdateDocument(projectKey);
  const setDocumentAccess = useSetDocumentAccess(projectKey);
  const setDocumentLocked = useSetDocumentLocked(projectKey);
  const archiveDocument = useArchiveDocument(projectKey);
  const restoreDocument = useRestoreDocument(projectKey);
  const setDocumentFavorite = useSetDocumentFavorite(projectKey);
  const uploadDocumentAsset = useUploadDocumentAsset(projectKey, document.id);
  const {
    legacyDraft,
    title,
    content,
    contentJson,
    dirty,
    saveState,
    version,
    editorRevision,
    setTitle,
    setContent,
    save,
    replaceWith,
    adoptServerDocument,
  } = useDocumentDraft({
    projectKey,
    document,
    editable: editorEditable,
    userId: currentUserId,
    collaborative: editable,
  });
  const collaboration = useDocumentCollaboration({
    editor,
    projectKey,
    document,
    userId: currentUserId,
    enabled: editable && !legacyDraft,
    onSaved: adoptServerDocument,
  });
  useDocumentCommentMarks(
    editor,
    projectKey,
    document.id,
    () => {
      setCommentsOpen(true);
      setInspectorOpen(false);
    },
    editable ? collaboration.version : document.version,
  );
  const providerActionPending =
    updateDocument.isPending ||
    setDocumentAccess.isPending ||
    setDocumentLocked.isPending ||
    archiveDocument.isPending ||
    restoreDocument.isPending ||
    setDocumentFavorite.isPending;
  const actionPending = documentAction.pending || providerActionPending;
  const busy =
    actionPending ||
    saveState === 'saving' ||
    (editable && (!collaboration.ready || collaboration.status === 'saving'));

  useEffect(() => {
    const element = titleRef.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${element.scrollHeight}px`;
  }, [title]);

  const reload = async () => {
    const latest = await onReload();
    if (latest) replaceWith(latest);
  };

  const prepareVersion = async () => {
    if (providerActionPending || saveState === 'conflict' || saveState === 'error') return null;
    const synchronized = editable ? await collaboration.flush() : null;
    if (editable && !synchronized) return null;
    const updatedDraft = await save();
    if (dirty && !updatedDraft) return null;
    return updatedDraft?.version ?? synchronized?.version ?? version;
  };

  const runVersioned = async (
    action: (baseVersion: number) => Promise<ProjectDocument>,
    replace = false,
  ) =>
    documentAction.run(async () => {
      const baseVersion = await prepareVersion();
      if (baseVersion === null) return null;
      try {
        const changed = await action(baseVersion);
        if (replace) replaceWith(changed);
        else adoptServerDocument(changed);
        return changed;
      } catch {
        // The shared mutation error handler reports the failure. Keeping the
        // current document intact lets the user retry without losing their draft.
        return null;
      }
    });

  const updateLabel = authorName
    ? t('updatedBy', { name: authorName, time: relativeTime(document.updatedAt) })
    : t('updated', { time: relativeTime(document.updatedAt) });

  return (
    <main className="relative flex min-w-0 flex-1 overflow-hidden bg-background">
      <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <DocumentEditorHeader
          projectKey={projectKey}
          projectName={projectName}
          document={document}
          ancestors={ancestors}
          title={title}
          content={() => editor?.storage.markdown.getMarkdown() ?? content}
          richHtml={() => editor?.getHTML() ?? ''}
          saveState={
            editable && collaboration.status !== 'saved'
              ? ['connecting', 'saving'].includes(collaboration.status)
                ? 'saving'
                : 'error'
              : saveState
          }
          dirty={dirty}
          stickyToolbar={stickyToolbar}
          canCreate={canCreate}
          canUpdate={editable}
          canManage={canManage}
          canManageLifecycle={canManageLifecycle}
          canDelete={canManageLifecycle}
          busy={busy}
          onBack={onBack}
          onRetrySave={() => {
            collaboration.retry();
            void save();
          }}
          onFullWidthChange={(fullWidth) => {
            void runVersioned((baseVersion) =>
              updateDocument.mutateAsync({
                documentId: document.id,
                patch: { version: baseVersion, fullWidth },
              }),
            );
          }}
          onStickyToolbarChange={setStickyToolbar}
          onCreateChild={onCreateChild}
          onDuplicate={() => {
            void documentAction.run(async () => {
              const baseVersion = await prepareVersion();
              if (baseVersion !== null) await onDuplicate(title, baseVersion);
            });
          }}
          onFavoriteChange={(isFavorite) => {
            void setDocumentFavorite
              .mutateAsync({ documentId: document.id, isFavorite })
              .catch(() => undefined);
          }}
          onLockChange={(locked) => {
            void runVersioned((baseVersion) =>
              setDocumentLocked.mutateAsync({
                documentId: document.id,
                version: baseVersion,
                locked,
              }),
            );
          }}
          onPrivacyChange={(isPrivate) => {
            void runVersioned((baseVersion) =>
              setDocumentAccess.mutateAsync({
                documentId: document.id,
                version: baseVersion,
                isPrivate,
              }),
            );
          }}
          onArchive={() => {
            void runVersioned((baseVersion) =>
              archiveDocument.mutateAsync({ documentId: document.id, version: baseVersion }),
            ).then((changed) => {
              if (changed) onBack();
            });
          }}
          onRestore={() => {
            void runVersioned((baseVersion) =>
              restoreDocument.mutateAsync({ documentId: document.id, version: baseVersion }),
            );
          }}
          onDelete={() => setDeleteOpen(true)}
          commentsOpen={commentsOpen}
          onCommentsOpen={() => {
            setCommentsOpen((value) => !value);
            setInspectorOpen(false);
          }}
          inspectorOpen={inspectorOpen}
          onInspectorOpenChange={(open) => {
            setInspectorOpen(open);
            if (open) setCommentsOpen(false);
          }}
          onOpenHistory={() => setHistoryOpen(true)}
        />

        {editable && !legacyDraft && (
          <DocumentSyncBanner
            state={collaboration.status}
            onRetry={collaboration.retry}
            recoveryConflict={collaboration.recoveryConflict}
            onDiscardRecovery={collaboration.discardRecovery}
            onExportRecovery={() => {
              if (!editor) return;
              const url = URL.createObjectURL(
                new Blob([editor.storage.markdown.getMarkdown()], {
                  type: 'text/markdown;charset=utf-8',
                }),
              );
              const link = window.document.createElement('a');
              link.href = url;
              link.download = `${title || 'document'}-recovery.md`;
              link.click();
              URL.revokeObjectURL(url);
            }}
          />
        )}
        {saveState === 'conflict' && (
          <DocumentConflictBanner onReload={() => setDiscardOpen(true)} />
        )}
        <DocumentEditorCanvas
          projectKey={projectKey}
          document={document}
          title={title}
          content={content}
          contentJson={contentJson}
          editorRevision={editorRevision}
          editor={editor}
          titleRef={titleRef}
          editable={editorEditable && collaboration.ready}
          collaborative
          onComment={() => {
            void collaboration.flush().then((saved) => {
              if (!editor || !saved) return;
              const { from, to } = editor.state.selection;
              setCommentSelection({
                from,
                to,
                quote: editor.state.doc.textBetween(from, to, '\n'),
                version: saved.version,
              });
              setCommentsOpen(true);
              setInspectorOpen(false);
            });
          }}
          stickyToolbar={stickyToolbar}
          updateLabel={updateLabel}
          onEditorReady={setEditor}
          onTitleChange={setTitle}
          onTitleSave={() => void save()}
          onIconChange={(icon) => {
            void runVersioned((baseVersion) =>
              updateDocument.mutateAsync({
                documentId: document.id,
                patch: { version: baseVersion, icon },
              }),
            );
          }}
          onContentChange={({ markdown, json }) => setContent(markdown, json)}
          onContentBlur={() => {
            void collaboration.flush();
            void save();
          }}
          onUploadImage={(file) => uploadDocumentAsset.mutateAsync(file)}
        />
      </section>

      {commentsOpen && (
        <DocumentCommentsPanel
          editor={editor}
          projectKey={projectKey}
          documentId={document.id}
          version={version}
          selection={commentSelection}
          canComment={canEdit && document.archivedAt === null}
          onClose={() => setCommentsOpen(false)}
          onCommented={() => setCommentSelection(null)}
        />
      )}
      <DocumentEditorInspector
        open={inspectorOpen}
        projectKey={projectKey}
        document={{ ...document, title, content, contentJson, version }}
        editor={editor}
        authorNames={authorNames}
        canUpload={editorEditable}
        canDeleteAssets={canManageLifecycle && editorEditable}
        canReadWorkItems={canReadWorkItems}
        canLinkWorkItems={canLinkWorkItems && document.archivedAt === null}
        onOpenChange={setInspectorOpen}
        onOpenHistory={() => setHistoryOpen(true)}
      />

      {deleteOpen && (
        <DocumentDeleteDialog
          onClose={() => setDeleteOpen(false)}
          onDelete={async () => {
            await onDelete(version);
            setDeleteOpen(false);
          }}
        />
      )}
      {discardOpen && (
        <DocumentDiscardDraftDialog
          onClose={() => setDiscardOpen(false)}
          onDiscard={async () => {
            await reload();
            setDiscardOpen(false);
          }}
        />
      )}
      <DocumentHistoryDialog
        open={historyOpen}
        projectKey={projectKey}
        documentId={document.id}
        version={version}
        authorNames={authorNames}
        canRestore={editorEditable && !dirty && !busy}
        onOpenChange={setHistoryOpen}
        onRestored={(changed) => replaceWith(changed)}
      />
    </main>
  );
}
