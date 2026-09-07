'use client';

import { useMemo, useState } from 'react';
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
import type { ProjectDocumentSummary } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { projectedDocumentMove } from '../utils/documentMove';
import SortableDocumentRow from './SortableDocumentRow';

export type DocumentSort = 'position' | 'title' | 'created' | 'updated';

export default function DocumentTree({
  projectKey,
  documents,
  activeId,
  searching,
  sortBy,
  sortDirection,
  canCreate,
  reorderEnabled,
  favoritePending,
  onCreate,
  onMove,
  onFavoriteChange,
}: {
  projectKey: string;
  documents: ProjectDocumentSummary[];
  activeId: number | null;
  searching: boolean;
  sortBy: DocumentSort;
  sortDirection: 'asc' | 'desc';
  canCreate: boolean;
  reorderEnabled: boolean;
  favoritePending: boolean;
  onCreate: (parentId: number | null) => void;
  onMove: (input: {
    documentId: number;
    version: number;
    parentId: number | null;
    position: number;
    previousSiblingId: number | null;
    nextSiblingId: number | null;
  }) => void;
  onFavoriteChange: (documentId: number, isFavorite: boolean) => void;
}) {
  const t = useTranslations('documents');
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
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
      siblings.sort((a, b) => {
        let result = a.position - b.position || a.id - b.id;
        if (sortBy === 'title') result = a.title.localeCompare(b.title) || a.id - b.id;
        if (sortBy === 'created') {
          result = Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id - b.id;
        }
        if (sortBy === 'updated') {
          result = Date.parse(a.updatedAt) - Date.parse(b.updatedAt) || a.id - b.id;
        }
        return sortBy !== 'position' && sortDirection === 'desc' ? -result : result;
      });
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

  function renderDocument(item: ProjectDocumentSummary, depth: number, nested: boolean) {
    const children = byParent.get(item.id) ?? [];
    const isCollapsed = collapsed.has(item.id);
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
        canCreate={canCreate}
        reorderEnabled={reorderEnabled}
        favoritePending={favoritePending}
        onToggle={() => toggle(item.id)}
        onCreate={() => onCreate(item.id)}
        onFavoriteChange={() => onFavoriteChange(item.id, !item.isFavorite)}
      >
        {nested && !isCollapsed && children.length > 0 && renderRows(item.id, depth + 1)}
      </SortableDocumentRow>
    );
  }

  function renderRows(parentId: number | null, depth: number) {
    return (
      <ul role={depth === 0 ? 'tree' : 'group'} className={depth === 0 ? 'space-y-px' : undefined}>
        {(byParent.get(parentId) ?? []).map((item) => renderDocument(item, depth, true))}
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
              {ordered.map((item) => renderDocument(item, 0, false))}
            </ul>
          ) : (
            renderRows(null, 0)
          )}
        </nav>
      </SortableContext>
    </DndContext>
  );
}
