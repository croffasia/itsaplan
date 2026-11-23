'use client';

import type { ProjectDocumentSummary } from '@/lib/api/endpoints/documents';
import { useIsPhone } from '@/hooks/useIsPhone';
import { usePermissions } from '@/hooks/usePermissions';
import { useSession } from '@/lib/auth-client';
import { useDocumentTreeActions } from '../../hooks/useDocumentTreeActions';
import { useDocumentTreeCollapsed } from '../../hooks/useDocumentTreeCollapsed';
import { useDocumentTreeLayout } from '../../hooks/useDocumentTreeLayout';
import { useSharedDocumentIds } from '../../services/documents.service';
import type { DocumentSort } from '../../utils/documentList';
import { managesDocument } from '../../utils/documentAccess';
import { adjacentDocumentMove, documentStepTarget } from '../../utils/documentMove';
import DocumentRowMenu from './DocumentRowMenu';
import DocumentTreeDnd from './DocumentTreeDnd';
import SortableDocumentRow from './SortableDocumentRow';

export default function DocumentTree({
  projectKey,
  label,
  documents,
  activeId,
  sortBy,
  sortDirection,
  reorderEnabled,
  onCreate,
}: {
  projectKey: string;
  label: string;
  documents: ProjectDocumentSummary[];
  activeId: number | null;
  sortBy: DocumentSort;
  sortDirection: 'asc' | 'desc';
  reorderEnabled: boolean;
  onCreate: (parentId: number, isPrivate: boolean) => void;
}) {
  const { can, isOwner } = usePermissions();
  const userId = useSession().data?.user.id ?? null;
  const isPhone = useIsPhone();
  const actions = useDocumentTreeActions(projectKey, activeId);
  const { collapsed, toggle } = useDocumentTreeCollapsed(projectKey, activeId, documents);
  const { byId, byParent, ordered } = useDocumentTreeLayout(documents, sortBy, sortDirection);
  const shared = useSharedDocumentIds(projectKey).data;
  const canEdit = can('documents', 'edit');
  const canCreate = can('documents', 'create');
  const steppable = reorderEnabled && !actions.movePending;
  // A touch on a phone scrolls the rail; Move up and Move down still reorder there.
  const draggable = steppable && !isPhone;

  const step = (source: ProjectDocumentSummary, direction: -1 | 1) => {
    const move = adjacentDocumentMove({ source, direction, ordered, byParent, byId });
    if (move) actions.reorder(source, move);
  };

  const visibleIds: number[] = [];
  const collectVisible = (parentId: number | null) => {
    for (const item of byParent.get(parentId) ?? []) {
      visibleIds.push(item.id);
      if (!collapsed.has(item.id)) collectVisible(item.id);
    }
  };
  collectVisible(null);

  function renderRows(parentId: number | null, depth: number) {
    const siblings = byParent.get(parentId) ?? [];
    return (
      <ul role={depth === 0 ? 'tree' : 'group'} aria-label={depth === 0 ? label : undefined}>
        {siblings.map((item) => {
          const children = byParent.get(item.id) ?? [];
          const isCollapsed = collapsed.has(item.id);
          const creatable = canCreate && item.archivedAt === null;
          const create = () => onCreate(item.id, item.isPrivate);
          return (
            <SortableDocumentRow
              key={item.id}
              projectKey={projectKey}
              document={item}
              depth={depth}
              active={activeId === item.id}
              shared={shared?.has(item.id) ?? false}
              collapsed={isCollapsed}
              hasChildren={children.length > 0}
              canCreate={creatable}
              draggable={draggable && !item.isLocked}
              menu={
                <DocumentRowMenu
                  projectKey={projectKey}
                  document={item}
                  canCreate={creatable}
                  canPin={canEdit}
                  canMove={canEdit}
                  canArchive={can('documents', 'delete') && managesDocument(item, userId, isOwner)}
                  canStepUp={steppable && documentStepTarget(item, -1, siblings) !== null}
                  canStepDown={steppable && documentStepTarget(item, 1, siblings) !== null}
                  pending={actions.pending}
                  onCreate={create}
                  onPinChange={() => actions.togglePinned(item)}
                  onFavoriteChange={() => actions.toggleFavorite(item)}
                  onStep={(direction) => step(item, direction)}
                  onMoveTo={(move, parent) => actions.moveTo(item, move, parent)}
                  onArchive={() => actions.archive(item)}
                />
              }
              onToggle={() => toggle(item.id)}
              onCreate={create}
            >
              {!isCollapsed && children.length > 0 && renderRows(item.id, depth + 1)}
            </SortableDocumentRow>
          );
        })}
      </ul>
    );
  }

  return (
    <DocumentTreeDnd
      byId={byId}
      byParent={byParent}
      ordered={ordered}
      visibleIds={visibleIds}
      enabled={draggable}
      onReorder={actions.reorder}
    >
      {renderRows(null, 0)}
    </DocumentTreeDnd>
  );
}
