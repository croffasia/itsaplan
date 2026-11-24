'use client';

import { useState } from 'react';
import { Copy, Ellipsis } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ProjectDocument, ProjectDocumentSummary } from '@/lib/api/endpoints/documents';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { DocumentPlacement } from '../../utils/documentMove';
import DocumentExportDialog from './DocumentExportDialog';
import DocumentIconButton from '../DocumentIconButton';
import DocumentMoveDialog from '../DocumentMoveDialog';
import DocumentOptionsActiveItems from './DocumentOptionsActiveItems';
import DocumentPinItem from './DocumentPinItem';
import DocumentOptionsArchivedItems from './DocumentOptionsArchivedItems';
import DocumentReadMenuItems from './DocumentReadMenuItems';

export default function DocumentOptionsMenu({
  projectKey,
  document,
  title,
  content,
  richHtml,
  stickyToolbar,
  canEdit,
  canCreate,
  canManage,
  canManageLifecycle,
  busy,
  onStickyToolbarChange,
  onCreateChild,
  onDuplicate,
  onMove,
  onLockChange,
  onArchive,
  onRestore,
  onDelete,
  onOpenHistory,
}: {
  projectKey: string;
  document: ProjectDocument;
  title: string;
  content: () => string;
  richHtml: () => string;
  stickyToolbar: boolean;
  // The role may edit Docs; the page itself may still be locked or archived.
  canEdit: boolean;
  canCreate: boolean;
  canManage: boolean;
  canManageLifecycle: boolean;
  busy: boolean;
  onStickyToolbarChange: (value: boolean) => void;
  onCreateChild: () => void;
  onDuplicate: () => void;
  onMove: (move: DocumentPlacement, parent: ProjectDocumentSummary | null) => void;
  onLockChange: (locked: boolean) => void;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
  onOpenHistory: () => void;
}) {
  const t = useTranslations('documents');
  const [exportOpen, setExportOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const archived = document.archivedAt !== null;

  const readItems = (
    <DocumentReadMenuItems
      content={content}
      onExport={() => setExportOpen(true)}
      onOpenHistory={onOpenHistory}
    />
  );
  const copyItem = canCreate && (
    <DropdownMenuItem disabled={busy} onSelect={onDuplicate}>
      <Copy />
      {t('makeCopy')}
    </DropdownMenuItem>
  );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <DocumentIconButton label={t('documentActions')} aria-busy={busy}>
            <Ellipsis />
          </DocumentIconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          {archived ? (
            <DocumentOptionsArchivedItems
              canCreate={canCreate}
              canManageLifecycle={canManageLifecycle}
              busy={busy}
              copyItem={copyItem}
              readItems={readItems}
              onRestore={onRestore}
              onDelete={onDelete}
            />
          ) : (
            <DocumentOptionsActiveItems
              locked={document.isLocked}
              stickyToolbar={stickyToolbar}
              canEdit={canEdit}
              canCreate={canCreate}
              canManage={canManage}
              canManageLifecycle={canManageLifecycle}
              busy={busy}
              copyItem={copyItem}
              pinItem={canEdit && <DocumentPinItem projectKey={projectKey} document={document} />}
              readItems={readItems}
              onStickyToolbarChange={onStickyToolbarChange}
              onCreateChild={onCreateChild}
              onMove={() => setMoveOpen(true)}
              onLockChange={onLockChange}
              onArchive={onArchive}
            />
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <DocumentExportDialog
        open={exportOpen}
        documentId={document.id}
        title={title}
        content={content}
        richHtml={richHtml}
        onOpenChange={setExportOpen}
      />
      {moveOpen && (
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
    </>
  );
}
