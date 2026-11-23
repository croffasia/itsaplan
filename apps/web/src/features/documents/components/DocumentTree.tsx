'use client';

import { useMemo } from 'react';
import { useDocumentNavigation } from '@/hooks/useDocumentNavigation';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { FilePlus2, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ProjectDocumentSummary } from '@/lib/api/endpoints/documents';
import { Button } from '@/components/ui/button';
import { compareDocuments, type DocumentSort } from '../utils/documentList';
import {
  adjacentDocumentMove,
  documentStepTarget,
  projectedDocumentMove,
  type OptimisticDocumentMove,
} from '../utils/documentMove';
import DocumentRowMenu from './DocumentRowMenu';
import SortableDocumentRow from './SortableDocumentRow';

const treeDefaults: { collapsed: number[] } = { collapsed: [] };

export default function DocumentTree({
  projectKey,
  documents,
  activeId,
  searching,
  sortBy,
  sortDirection,
  canCreate,
  canMove,
  movePending,
  canPin,
  reorderEnabled,
  favoritePending,
  pinPending,
  onCreate,
  onMove,
  onMoveTo,
  onFavoriteChange,
  onPinChange,
}: {
  projectKey: string;
  documents: ProjectDocumentSummary[];
  activeId: number | null;
  searching: boolean;
  sortBy: DocumentSort;
  sortDirection: 'asc' | 'desc';
  canCreate: boolean;
  canMove: boolean;
  movePending: boolean;
  canPin: boolean;
  reorderEnabled: boolean;
  favoritePending: boolean;
  pinPending: boolean;
  onCreate: (parentId: number | null) => void;
  onMove: (input: OptimisticDocumentMove & { version: number }) => void;
  onMoveTo: (
    input: OptimisticDocumentMove & { version: number },
    parent: ProjectDocumentSummary | null,
  ) => void;
  onFavoriteChange: (documentId: number, isFavorite: boolean) => void;
  onPinChange: (documentId: number, isPinned: boolean) => void;
}) {
  const t = useTranslations('documents');
  const [treeState, setTreeState] = useDocumentNavigation(projectKey, 'tree', treeDefaults);
  const collapsed = useMemo(() => new Set(treeState.collapsed), [treeState.collapsed]);
  const setCollapsed = (update: (previous: Set<number>) => Set<number>) =>
    setTreeState((previous) => ({ collapsed: [...update(new Set(previous.collapsed))] }));
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const byId = useMemo(() => new Map(documents.map((item) => [item.id, item])), [documents]);
  const byParent = useMemo(() => {
    const groups = new Map<number | null, ProjectDocumentSummary[]>();
    for (const item of documents) {
      const parentId = item.parentId !== null && byId.has(item.parentId) ? item.parentId : null;
      const siblings = groups.get(parentId) ?? [];
      siblings.push(item);
      groups.set(parentId, siblings);
    }

    for (const siblings of groups.values()) {
      siblings.sort((a, b) => compareDocuments(a, b, sortBy, sortDirection));
    }
    return groups;
  }, [byId, documents, sortBy, sortDirection]);
  const ordered = useMemo(() => {
    const result: ProjectDocumentSummary[] = [];
    const visited = new Set<number>();
    const visit = (parentId: number | null) => {
      for (const item of byParent.get(parentId) ?? []) {
        if (visited.has(item.id)) continue;
        visited.add(item.id);
        result.push(item);
        visit(item.id);
      }
    };
    visit(null);
    for (const item of documents) {
      if (!visited.has(item.id)) result.push(item);
    }
    return result;
  }, [byParent, documents]);
  const visibleIds = useMemo(() => {
    if (searching) return ordered.map((item) => item.id);
    const result: number[] = [];
    const visit = (parentId: number | null) => {
      for (const item of byParent.get(parentId) ?? []) {
        result.push(item.id);
        if (!collapsed.has(item.id)) visit(item.id);
      }
    };
    visit(null);
    return result;
  }, [byParent, collapsed, ordered, searching]);

  const toggle = (documentId: number) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(documentId)) next.delete(documentId);
      else next.add(documentId);
      return next;
    });
  };

  const step = (source: ProjectDocumentSummary, direction: -1 | 1) => {
    const move = adjacentDocumentMove({ source, direction, ordered, byParent, byId });
    if (move) onMove({ documentId: source.id, version: source.version, ...move });
  };

  function renderDocument(
    item: ProjectDocumentSummary,
    depth: number,
    nested: boolean,
    siblings: ProjectDocumentSummary[],
  ) {
    const children = byParent.get(item.id) ?? [];
    const isCollapsed = collapsed.has(item.id);
    const pinnable = canPin && !item.isPrivate && item.archivedAt === null;
    const creatable = canCreate && item.archivedAt === null;
    const create = () => onCreate(item.id);
    const favoriteChange = () => onFavoriteChange(item.id, !item.isFavorite);
    const pinChange = () => onPinChange(item.id, !item.isPinned);
    return (
      <SortableDocumentRow
        key={item.id}
        projectKey={projectKey}
        document={item}
        depth={depth}
        nested={nested}
        active={activeId === item.id}
        collapsed={isCollapsed}
        hasChildren={children.length > 0}
        canCreate={creatable}
        pinnable={pinnable}
        reorderEnabled={reorderEnabled}
        favoritePending={favoritePending}
        pinPending={pinPending}
        menu={
          <DocumentRowMenu
            projectKey={projectKey}
            document={item}
            canCreate={creatable}
            pinnable={pinnable}
            movable={canMove && item.archivedAt === null && !item.isLocked}
            reorderEnabled={reorderEnabled}
            canStepUp={documentStepTarget(item, -1, siblings) !== null}
            canStepDown={documentStepTarget(item, 1, siblings) !== null}
            favoritePending={favoritePending}
            pinPending={pinPending}
            movePending={movePending}
            onFavoriteChange={favoriteChange}
            onPinChange={pinChange}
            onCreate={create}
            onMoveTo={(move, parent) =>
              onMoveTo({ documentId: item.id, version: item.version, ...move }, parent)
            }
            onStep={(direction) => step(item, direction)}
          />
        }
        onToggle={() => toggle(item.id)}
        onCreate={create}
        onFavoriteChange={favoriteChange}
        onPinChange={pinChange}
      >
        {nested && !isCollapsed && children.length > 0 && renderRows(item.id, depth + 1)}
      </SortableDocumentRow>
    );
  }

  function renderRows(parentId: number | null, depth: number) {
    const siblings = byParent.get(parentId) ?? [];
    return (
      <ul role={depth === 0 ? 'tree' : 'group'} className={depth === 0 ? 'space-y-px' : undefined}>
        {siblings.map((item) => renderDocument(item, depth, true, siblings))}
      </ul>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center px-4 text-center">
        <div className="mb-3 grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
          <FilePlus2 className="size-4" />
        </div>
        <p className="text-sm font-medium">{t('noResults')}</p>
        {canCreate && !searching && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() => onCreate(null)}
          >
            <Plus />
            {t('newDocument')}
          </Button>
        )}
      </div>
    );
  }

  const dragEnd = ({ active, over, delta }: DragEndEvent) => {
    if (!reorderEnabled || !over || active.id === over.id) return;
    const source = byId.get(Number(active.id));
    const target = byId.get(Number(over.id));
    if (!source || !target) return;
    const projected = projectedDocumentMove({
      source,
      target,
      deltaX:
        typeof document !== 'undefined' && document.documentElement.dir === 'rtl'
          ? -delta.x
          : delta.x,
      ordered,
      byParent,
      byId,
    });
    if (projected) onMove({ documentId: source.id, version: source.version, ...projected });
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={dragEnd}
      accessibility={{
        screenReaderInstructions: { draggable: t('dragInstructions') },
        announcements: {
          onDragStart: ({ active }) =>
            t('dragStarted', { title: byId.get(Number(active.id))?.title ?? '' }),
          onDragOver: ({ over }) =>
            over ? t('dragOver', { title: byId.get(Number(over.id))?.title ?? '' }) : undefined,
          onDragEnd: ({ over }) =>
            over
              ? t('dragEnded', { title: byId.get(Number(over.id))?.title ?? '' })
              : t('dragCanceled'),
          onDragCancel: () => t('dragCanceled'),
        },
      }}
    >
      <SortableContext items={visibleIds} strategy={verticalListSortingStrategy}>
        <nav aria-label={t('treeLabel')}>
          {searching ? (
            <ul role="tree" className="space-y-px">
              {ordered.map((item) => renderDocument(item, 0, false, ordered))}
            </ul>
          ) : (
            renderRows(null, 0)
          )}
        </nav>
      </SortableContext>
    </DndContext>
  );
}
