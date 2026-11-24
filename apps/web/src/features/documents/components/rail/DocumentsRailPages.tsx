'use client';

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type {
  NewProjectDocumentInput,
  ProjectDocumentSummary,
} from '@/lib/api/endpoints/documents';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/hooks/usePermissions';
import { documentPath } from '@/utils/paths';
import { useDocumentsRailView } from '../../hooks/useDocumentsRailView';
import { compareDocuments, documentGroup, documentMatchesFilters } from '../../utils/documentList';
import DocumentTree from './DocumentTree';
import DocumentsRailEmpty from './DocumentsRailEmpty';
import DocumentsRailGroup from './DocumentsRailGroup';
import DocumentsRailIcon from '../DocumentsRailIcon';
import DocumentsRailLink from './DocumentsRailLink';

// Favorites, then the project's pages and the private ones as two trees. Pages that only some
// people can open count as private, as in Move to, so a drag never crosses the two.
export default function DocumentsRailPages({
  projectKey,
  documents,
  activeId,
  canCreate,
  creating,
  onCreate,
}: {
  projectKey: string;
  documents: ProjectDocumentSummary[];
  activeId: number | null;
  canCreate: boolean;
  creating: boolean;
  onCreate: (input: NewProjectDocumentInput) => void;
}) {
  const t = useTranslations('documents');
  const { can } = usePermissions();
  const view = useDocumentsRailView(projectKey);
  const now = Date.now();
  const shown = documents.filter((document) =>
    documentMatchesFilters(document, view.creatorId, view.range, now),
  );

  if (shown.length === 0) {
    return (
      <DocumentsRailEmpty
        title={t('noFilterMatches')}
        action={
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2.5 text-[13px]"
            onClick={view.clearFilters}
          >
            <X />
            {t('clearFilters')}
          </Button>
        }
      />
    );
  }

  const favorites = shown
    .filter((document) => document.isFavorite)
    .sort((a, b) => compareDocuments(a, b, view.sort, view.direction));
  const reorder = can('documents', 'edit') && view.sort === 'position' && view.filterCount === 0;
  const tree = (label: string, isPrivate: boolean) => {
    const group = documentGroup(shown.filter((document) => document.isPrivate === isPrivate));
    if (group.documents.length === 0 && isPrivate && view.filterCount > 0) return null;
    return (
      <DocumentsRailGroup
        label={label}
        create={
          canCreate
            ? {
                label: isPrivate ? t('newPrivatePage') : t('newPageInPages'),
                title: isPrivate ? t('newPrivatePage') : t('newDocument'),
                disabled: creating,
                onClick: () => onCreate({ parentId: null, isPrivate }),
              }
            : undefined
        }
      >
        {group.documents.length > 0 && (
          <DocumentTree
            projectKey={projectKey}
            label={label}
            documents={group.documents}
            activeId={activeId}
            sortBy={view.sort}
            sortDirection={view.direction}
            reorderEnabled={reorder && group.reorderSafe}
            onCreate={(parentId, isPrivate) => onCreate({ parentId, isPrivate })}
          />
        )}
      </DocumentsRailGroup>
    );
  };

  return (
    <>
      {favorites.length > 0 && (
        <DocumentsRailGroup label={t('favoritePages')}>
          {favorites.map((document) => (
            <DocumentsRailLink
              key={document.id}
              href={documentPath(projectKey, document.id)}
              active={document.id === activeId}
              icon={<DocumentsRailIcon icon={document.icon} />}
              title={document.title.trim() || t('untitled')}
            />
          ))}
        </DocumentsRailGroup>
      )}
      {tree(t('pagesGroup'), false)}
      {tree(t('privatePages'), true)}
    </>
  );
}
