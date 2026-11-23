'use client';

import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import type { ProjectDocument, ProjectDocumentSummary } from '@/lib/api/endpoints/documents';
import { useSession } from '@/lib/auth-client';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useDocumentCommentMarks } from '../../hooks/useDocumentCommentMarks';
import { useDocumentCollaboration } from '../../hooks/useDocumentCollaboration';
import DocumentCommentsPanel from './DocumentCommentsPanel';
import { useDocumentDraft } from '../../hooks/useDocumentDraft';
import { useDocumentActionGate } from '../../hooks/useDocumentActionGate';
import { useDocumentEditorActions } from '../../hooks/useDocumentEditorActions';
import { useDocumentEditorPanels } from '../../hooks/useDocumentEditorPanels';
import { useDocumentEditorPreferences } from '../../hooks/useDocumentEditorPreferences';
import { managesDocument } from '../../utils/documentAccess';
import { documentPageStatus } from '../../utils/documentPageStatus';
import { documentChildren } from '../../utils/documentTree';
import DocumentDeleteDialog from '../DocumentDeleteDialog';
import DocumentDiscardDraftDialog from './DocumentDiscardDraftDialog';
import DocumentEditorBanners from './DocumentEditorBanners';
import DocumentEditorCanvas from './DocumentEditorCanvas';
import DocumentEditorHeader from './DocumentEditorHeader';
import DocumentEditorInspector from './DocumentEditorInspector';
import DocumentHistoryDialog from './DocumentHistoryDialog';
import DocumentPageProperties from './DocumentPageProperties';
import DocumentSubpages from './DocumentSubpages';

export default function DocumentEditor({
  projectKey,
  projectName,
  document,
  ancestors,
  documents,
  owner,
  authorNames,
  canEdit,
  canShare,
  sharingEnabled,
  canReadWorkItems,
  canLinkWorkItems,
  isProjectOwner,
  canCreate,
  canDelete,
  commentId = null,
  onBack,
  onCreate,
  onDuplicate,
  onDelete,
  onReload,
}: {
  projectKey: string;
  projectName: string;
  document: ProjectDocument;
  ancestors: ProjectDocumentSummary[];
  documents: ProjectDocumentSummary[];
  owner: { name: string; image: string | null } | null;
  authorNames: Record<string, string>;
  canEdit: boolean;
  // The role may manage public links; `sharingEnabled` says whether the project allows them.
  canShare: boolean;
  sharingEnabled: boolean;
  canReadWorkItems: boolean;
  canLinkWorkItems: boolean;
  isProjectOwner: boolean;
  canCreate: boolean;
  canDelete: boolean;
  commentId?: string | null;
  // Where an archived page leaves to. Left out where the page around the document has its
  // own way back.
  onBack?: () => void;
  onCreate: (parentId: number | null, isPrivate: boolean) => void;
  onDuplicate: (title: string, version: number) => Promise<void>;
  onDelete: (version: number) => Promise<void>;
  onReload: () => Promise<ProjectDocument | null>;
}) {
  const t = useTranslations('documents');
  const { data: session } = useSession();
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  // The local text a reload throws away: the REST draft or the unsynced session copy.
  const [discard, setDiscard] = useState<'draft' | 'recovery' | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyRevisionId, setHistoryRevisionId] = useState<number | null>(null);
  const [accessOpen, setAccessOpen] = useState(false);
  const panels = useDocumentEditorPanels(commentId);
  const documentAction = useDocumentActionGate();
  const currentUserId = session?.user.id ?? null;
  const ownsPage = currentUserId !== null && document.ownerUserId === currentUserId;
  const archived = document.archivedAt !== null;
  const editable = canEdit && currentUserId !== null && !document.isLocked && !archived;
  const editorEditable = editable && !documentAction.pending;
  const managesPage = managesDocument(document, currentUserId, isProjectOwner);
  const canManage = canEdit && managesPage;
  // Only its owner changes who sees a page: the API refuses a project owner too.
  const canChangeAccess = canEdit && ownsPage;
  const canManageLifecycle = canDelete && managesPage;
  const { stickyToolbar, setStickyToolbar } = useDocumentEditorPreferences();
  const draft = useDocumentDraft({
    projectKey,
    document,
    editable: editorEditable,
    userId: currentUserId,
    collaborative: editable,
  });
  const { legacyDraft, title, content, contentJson, dirty, saveState, version, save } = draft;
  const sessionShown = editable && !legacyDraft;
  const collaboration = useDocumentCollaboration({
    editor,
    projectKey,
    document,
    userId: currentUserId,
    enabled: sessionShown,
    onSaved: draft.adoptServerDocument,
  });
  useDocumentCommentMarks(
    editor,
    projectKey,
    document.id,
    panels.showThread,
    editable ? collaboration.version : document.version,
    collaboration.ready,
    panels.commentsOpen ? panels.activeCommentId : null,
  );
  // A session that failed to open holds no local steps, so an action goes with the
  // page's own version instead of waiting for a session that may never open.
  const usesSession = editable && !collaboration.openFailed;
  const actions = useDocumentEditorActions({
    projectKey,
    document,
    gate: documentAction,
    draft,
    collaboration,
    usesSession,
    onDuplicate,
    onArchived: onBack,
  });
  const busy =
    documentAction.pending ||
    actions.pending ||
    saveState === 'saving' ||
    (usesSession && (!collaboration.ready || collaboration.status === 'saving'));

  useEffect(() => {
    const element = titleRef.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${element.scrollHeight}px`;
  }, [title]);

  const status = documentPageStatus({
    archived,
    canEdit,
    locked: document.isLocked,
    sync: sessionShown ? collaboration.status : null,
    recovery: sessionShown && collaboration.recoveryConflict,
    save: saveState,
    dirty,
  });
  // The API lets a project owner hand over a page only when it is not private.
  const canTransferOwnership = canManage && !archived && (ownsPage || !document.isPrivate);
  const openHistory = (revisionId: number | null) => {
    setHistoryRevisionId(revisionId);
    setHistoryOpen(true);
  };

  return (
    <main className="relative flex min-w-0 flex-1 overflow-hidden bg-background">
      <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <DocumentEditorHeader
          projectKey={projectKey}
          projectName={projectName}
          document={document}
          ancestors={ancestors}
          documents={documents}
          status={status}
          canCreate={canCreate}
          favoriteBusy={actions.favoritePending}
          access={{
            canChange: canChangeAccess && !archived,
            canShare: canShare && !archived,
            sharingEnabled,
            disabled: busy,
            open: accessOpen,
            onOpenChange: setAccessOpen,
            onChange: actions.setAccess,
          }}
          menu={{
            title,
            content: () => editor?.storage.markdown.getMarkdown() ?? content,
            richHtml: () => editor?.getHTML() ?? '',
            stickyToolbar,
            canEdit,
            canManage,
            canManageLifecycle,
            busy,
            onStickyToolbarChange: setStickyToolbar,
            onCreateChild: () => onCreate(document.id, document.isPrivate),
            onDuplicate: actions.duplicate,
            onMove: actions.moveTo,
            onLockChange: actions.setLocked,
            onArchive: actions.archive,
            onRestore: actions.restore,
            onDelete: () => setDeleteOpen(true),
            onOpenHistory: () => openHistory(null),
          }}
          commentsOpen={panels.commentsOpen}
          inspectorOpen={panels.inspectorOpen}
          onCreate={onCreate}
          onRetrySave={() => {
            collaboration.retry();
            void save();
          }}
          onFavoriteChange={actions.setFavorite}
          onCommentsToggle={panels.toggleComments}
          onInspectorToggle={panels.toggleInspector}
        />

        <DocumentEditorCanvas
          projectKey={projectKey}
          document={document}
          title={title}
          content={content}
          contentJson={contentJson}
          editorRevision={draft.editorRevision}
          editor={editor}
          titleRef={titleRef}
          editing={sessionShown}
          editable={editorEditable && collaboration.ready}
          sidePanelOpen={panels.commentsOpen || panels.inspectorOpen}
          stickyToolbar={stickyToolbar}
          banner={
            <DocumentEditorBanners
              document={document}
              editor={editor}
              title={title}
              canEdit={canEdit}
              canManage={canManage}
              canManageLifecycle={canManageLifecycle}
              busy={busy}
              collaboration={sessionShown ? collaboration : null}
              conflict={saveState === 'conflict'}
              onUnlock={() => actions.setLocked(false)}
              onRestore={actions.restore}
              onDelete={() => setDeleteOpen(true)}
              onDiscard={setDiscard}
            />
          }
          properties={
            <DocumentPageProperties
              projectKey={projectKey}
              document={document}
              owner={owner}
              ownerIsYou={ownsPage}
              interactive={editable}
              publicLinkOn={document.shareToken !== null && sharingEnabled}
              canReadWorkItems={canReadWorkItems}
              onOpenDetails={panels.openDetails}
              onOpenAccess={archived ? undefined : () => setAccessOpen(true)}
            />
          }
          subpages={
            <DocumentSubpages
              projectKey={projectKey}
              pages={documentChildren(document.id, documents)}
              onCreate={
                canCreate && !archived ? () => onCreate(document.id, document.isPrivate) : undefined
              }
            />
          }
          onComment={() => {
            void collaboration.flush().then((saved) => {
              if (!editor || !saved) return;
              const { from, to } = editor.state.selection;
              panels.commentOn({
                from,
                to,
                quote: editor.state.doc.textBetween(from, to, '\n'),
                version: saved.version,
              });
            });
          }}
          onEditorReady={setEditor}
          onTitleChange={draft.setTitle}
          onTitleSave={() => void save()}
          onIconChange={actions.setIcon}
          onContentChange={({ markdown, json }) => draft.setContent(markdown, json)}
          onContentBlur={() => {
            void collaboration.flush();
            void save();
          }}
          onUploadImage={actions.uploadImage}
        />
      </section>

      {panels.commentsOpen && (
        <DocumentCommentsPanel
          editor={editor}
          projectKey={projectKey}
          documentId={document.id}
          version={version}
          selection={panels.commentSelection}
          canComment={canEdit && !archived}
          activeId={panels.activeCommentId}
          linkedId={panels.linkedCommentId}
          onActiveChange={panels.setActiveCommentId}
          onLinkShown={panels.onLinkShown}
          onClose={panels.closeComments}
          onDraftClose={panels.clearSelection}
        />
      )}
      {panels.inspectorOpen && (
        <DocumentEditorInspector
          projectKey={projectKey}
          document={{ ...document, title, content, contentJson, version }}
          ancestors={ancestors}
          editor={editor}
          canUpload={editorEditable}
          canDeleteAssets={canManageLifecycle && editorEditable}
          canReadWorkItems={canReadWorkItems}
          canLinkWorkItems={canLinkWorkItems && !archived}
          onTransferOwner={canTransferOwnership ? actions.transferOwner : undefined}
          onOpenAccess={archived ? undefined : () => setAccessOpen(true)}
          onMove={canEdit && !document.isLocked && !archived ? actions.moveTo : undefined}
          onOpenHistory={(revisionId) => openHistory(revisionId ?? null)}
          onClose={panels.closeInspector}
          focus={panels.detailsFocus}
        />
      )}

      {deleteOpen && (
        <DocumentDeleteDialog
          title={title}
          onClose={() => setDeleteOpen(false)}
          onDelete={async () => {
            await onDelete(version);
            setDeleteOpen(false);
            toast.success(t('deletedPage', { title: title.trim() || t('untitled') }));
          }}
        />
      )}
      {discard && (
        <DocumentDiscardDraftDialog
          onClose={() => setDiscard(null)}
          onDiscard={async () => {
            if (discard === 'recovery') collaboration.discardRecovery();
            else {
              const latest = await onReload();
              if (latest) draft.replaceWith(latest);
            }
            setDiscard(null);
          }}
        />
      )}
      <DocumentHistoryDialog
        open={historyOpen}
        projectKey={projectKey}
        documentId={document.id}
        version={version}
        initialRevisionId={historyRevisionId}
        authorNames={authorNames}
        canRestore={editorEditable && !dirty && !busy}
        onOpenChange={setHistoryOpen}
        onRestored={draft.replaceWith}
      />
    </main>
  );
}
