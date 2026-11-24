'use client';

import type { ReactNode } from 'react';
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
import { useTranslations } from 'next-intl';
import type { ProjectDocumentSummary } from '@/lib/api/endpoints/documents';
import { projectedDocumentMove, type DocumentPlacement } from '../../utils/documentMove';

// Enter keeps opening the page, so only Space picks it up.
const keyboardCodes = { start: ['Space'], cancel: ['Escape'], end: ['Space', 'Enter', 'Tab'] };

// Drag and drop for one page tree. A drop beside a row reorders; a drag toward the content nests
// the page under the row, and away from it moves the page up a level.
export default function DocumentTreeDnd({
  byId,
  byParent,
  ordered,
  visibleIds,
  enabled,
  onReorder,
  children,
}: {
  byId: Map<number, ProjectDocumentSummary>;
  byParent: Map<number | null, ProjectDocumentSummary[]>;
  ordered: ProjectDocumentSummary[];
  visibleIds: number[];
  enabled: boolean;
  onReorder: (source: ProjectDocumentSummary, placement: DocumentPlacement) => void;
  children: ReactNode;
}) {
  const t = useTranslations('documents');
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates, keyboardCodes }),
  );
  const title = (id: string | number) => byId.get(Number(id))?.title ?? '';

  const dragEnd = ({ active, over, delta }: DragEndEvent) => {
    if (!enabled || !over || active.id === over.id) return;
    const source = byId.get(Number(active.id));
    const target = byId.get(Number(over.id));
    if (!source || !target) return;
    const rtl = document.documentElement.dir === 'rtl';
    const projected = projectedDocumentMove({
      source,
      target,
      deltaX: rtl ? -delta.x : delta.x,
      ordered,
      byParent,
      byId,
    });
    if (projected) onReorder(source, projected);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={dragEnd}
      accessibility={{
        screenReaderInstructions: { draggable: t('dragInstructions') },
        announcements: {
          onDragStart: ({ active }) => t('dragStarted', { title: title(active.id) }),
          onDragOver: ({ over }) => (over ? t('dragOver', { title: title(over.id) }) : undefined),
          onDragEnd: ({ over }) =>
            over ? t('dragEnded', { title: title(over.id) }) : t('dragCanceled'),
          onDragCancel: () => t('dragCanceled'),
        },
      }}
    >
      <SortableContext items={visibleIds} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}
