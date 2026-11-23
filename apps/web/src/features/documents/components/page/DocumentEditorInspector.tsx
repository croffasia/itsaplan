'use client';

import { useEffect, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { useTranslations } from 'next-intl';
import type { ProjectDocument, ProjectDocumentSummary } from '@/lib/api/endpoints/documents';
import type { DocumentPlacement } from '../../utils/documentMove';
import DocumentDetailsAssets from './DocumentDetailsAssets';
import DocumentDetailsHistory from './DocumentDetailsHistory';
import DocumentDetailsProperties from './DocumentDetailsProperties';
import DocumentDetailsSection from './DocumentDetailsSection';
import DocumentDetailsWorkItems from './DocumentDetailsWorkItems';
import DocumentMoveDialog from '../DocumentMoveDialog';
import DocumentSidePanel from './DocumentSidePanel';

export default function DocumentEditorInspector({
  projectKey,
  document,
  ancestors,
  editor,
  canUpload,
  canDeleteAssets,
  canReadWorkItems,
  canLinkWorkItems,
  onTransferOwner,
  onOpenAccess,
  onMove,
  onOpenHistory,
  onClose,
  focus,
}: {
  projectKey: string;
  document: ProjectDocument;
  ancestors: ProjectDocumentSummary[];
  editor: Editor | null;
  canUpload: boolean;
  canDeleteAssets: boolean;
  canReadWorkItems: boolean;
  canLinkWorkItems: boolean;
  onTransferOwner?: (userId: string) => void;
  onOpenAccess?: () => void;
  onMove?: (move: DocumentPlacement, parent: ProjectDocumentSummary | null) => void;
  onOpenHistory: (revisionId?: number) => void;
  onClose: () => void;
  // The section to scroll to, a new object each time the page asks for it.
  focus: { section: 'work' } | null;
}) {
  const t = useTranslations('documents');
  const [moveOpen, setMoveOpen] = useState(false);
  useEffect(() => {
    if (focus)
      window.document
        .getElementById(`document-details-${focus.section}`)
        ?.scrollIntoView({ block: 'start' });
  }, [focus]);
  const text = editor && !editor.isDestroyed ? editor.getText() : document.content;
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  return (
    <DocumentSidePanel label={t('details')} closeLabel={t('closeDetails')} onClose={onClose}>
      <div className="min-h-0 flex-1 [scrollbar-width:thin] overflow-y-auto px-4 pt-1 pb-8">
        <DocumentDetailsSection id="props" title={t('inspector.properties')}>
          <DocumentDetailsProperties
            projectKey={projectKey}
            document={document}
            parent={ancestors.at(-1) ?? null}
            wordCount={wordCount}
            onTransferOwner={onTransferOwner}
            onOpenAccess={onOpenAccess}
            onMove={onMove && (() => setMoveOpen(true))}
          />
        </DocumentDetailsSection>
        {canReadWorkItems && (
          <DocumentDetailsWorkItems
            projectKey={projectKey}
            documentId={document.id}
            canLink={canLinkWorkItems}
          />
        )}
        <DocumentDetailsAssets
          projectKey={projectKey}
          documentId={document.id}
          editor={editor}
          canUpload={canUpload}
          canDelete={canDeleteAssets}
        />
        <DocumentDetailsHistory
          projectKey={projectKey}
          documentId={document.id}
          version={document.version}
          onOpen={onOpenHistory}
        />
      </div>
      {onMove && moveOpen && (
        <DocumentMoveDialog
          projectKey={projectKey}
          documentId={document.id}
          onPick={(move, parent) => {
            setMoveOpen(false);
            onMove(move, parent);
          }}
          onClose={() => setMoveOpen(false)}
        />
      )}
    </DocumentSidePanel>
  );
}
