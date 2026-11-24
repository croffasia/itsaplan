import type { ComponentProps } from 'react';
import { PanelRight, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ProjectDocument, ProjectDocumentSummary } from '@/lib/api/endpoints/documents';
import type { DocumentPageStatus } from '../../utils/documentPageStatus';
import DocumentAccessButton from './DocumentAccessButton';
import DocumentBreadcrumbs from './DocumentBreadcrumbs';
import DocumentCommentsButton from './DocumentCommentsButton';
import DocumentFavoriteButton from './DocumentFavoriteButton';
import DocumentIconButton from '../DocumentIconButton';
import DocumentOptionsMenu from './DocumentOptionsMenu';
import DocumentSaveStatus from './DocumentSaveStatus';
import DocumentTopBar from '../DocumentTopBar';

export default function DocumentEditorHeader({
  projectKey,
  projectName,
  document,
  ancestors,
  documents,
  status,
  canCreate,
  favoriteBusy,
  access,
  menu,
  commentsOpen,
  inspectorOpen,
  onCreate,
  onRetrySave,
  onFavoriteChange,
  onCommentsToggle,
  onInspectorToggle,
}: {
  projectKey: string;
  projectName: string;
  document: ProjectDocument;
  ancestors: ProjectDocumentSummary[];
  documents: ProjectDocumentSummary[];
  status: DocumentPageStatus;
  canCreate: boolean;
  favoriteBusy: boolean;
  access: Omit<
    ComponentProps<typeof DocumentAccessButton>,
    'projectKey' | 'document' | 'ancestors'
  >;
  menu: Omit<ComponentProps<typeof DocumentOptionsMenu>, 'projectKey' | 'document' | 'canCreate'>;
  commentsOpen: boolean;
  inspectorOpen: boolean;
  onCreate: (parentId: number | null, isPrivate: boolean) => void;
  onRetrySave: () => void;
  onFavoriteChange: (favorite: boolean) => void;
  onCommentsToggle: () => void;
  onInspectorToggle: () => void;
}) {
  const t = useTranslations('documents');
  const archived = document.archivedAt !== null;

  return (
    <DocumentTopBar>
      <DocumentBreadcrumbs
        projectKey={projectKey}
        projectName={projectName}
        document={document}
        ancestors={ancestors}
        documents={documents}
        canCreate={canCreate}
        onCreate={onCreate}
      />
      <div className="ms-auto flex shrink-0 items-center gap-0.5">
        <DocumentSaveStatus status={status} />
        {status === 'error' && (
          <DocumentIconButton label={t('retrySave')} onClick={onRetrySave}>
            <RefreshCw />
          </DocumentIconButton>
        )}
        <DocumentCommentsButton
          projectKey={projectKey}
          documentId={document.id}
          open={commentsOpen}
          onToggle={onCommentsToggle}
        />
        {!archived && (
          <DocumentFavoriteButton
            favorite={document.isFavorite}
            disabled={favoriteBusy}
            onChange={onFavoriteChange}
          />
        )}
        <DocumentAccessButton
          projectKey={projectKey}
          document={document}
          ancestors={ancestors}
          {...access}
        />
        <span className="mx-1.5 h-4 w-px bg-border max-md:hidden" aria-hidden />
        <DocumentIconButton
          label={t('details')}
          aria-pressed={inspectorOpen}
          onClick={onInspectorToggle}
        >
          <PanelRight className="rtl:-scale-x-100" />
        </DocumentIconButton>
        <DocumentOptionsMenu
          projectKey={projectKey}
          document={document}
          canCreate={canCreate}
          {...menu}
        />
      </div>
    </DocumentTopBar>
  );
}
