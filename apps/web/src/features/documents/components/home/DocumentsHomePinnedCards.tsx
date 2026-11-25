'use client';

import { useState } from 'react';
import { DndContext, DragOverlay, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy } from '@dnd-kit/sortable';
import { useTranslations } from 'next-intl';
import { useIsPhone } from '@/hooks/useIsPhone';
import { usePermissions } from '@/hooks/usePermissions';
import { useDndSensors, useDroppedOrder } from '@/lib/dnd';
import { useDocumentPin } from '../../hooks/useDocumentPin';
import { useMovePinnedDocument } from '../../services/documents.service';
import type { DocumentHomeCard } from '../../utils/documentHome';
import DocumentsHomeCard from './DocumentsHomeCard';
import DocumentsHomeCardMenu from './DocumentsHomeCardMenu';
import DocumentsHomeCardOverlay from './DocumentsHomeCardOverlay';

// The pinned cards in the order everyone in the project sees. A member who may pin drags a card
// to another place, or steps it from its menu: a touch on a phone scrolls the page instead.
export default function DocumentsHomePinnedCards({
  projectKey,
  cards,
}: {
  projectKey: string;
  cards: DocumentHomeCard[];
}) {
  const t = useTranslations('documents');
  const canPin = usePermissions().can('documents', 'edit');
  const isPhone = useIsPhone();
  const sensors = useDndSensors();
  const move = useMovePinnedDocument(projectKey);
  const pin = useDocumentPin(projectKey);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [moved, setMoved] = useState('');
  const { items, drop } = useDroppedOrder(cards.map((card) => ({ id: card.page.id, card })));
  const ids = items.map((item) => item.id);
  const pending = move.isPending || pin.pending;
  const name = (card: DocumentHomeCard) => card.page.title.trim() || t('untitled');
  const titleOf = (id: string | number) => {
    const item = items.find((entry) => entry.id === Number(id));
    return item ? name(item.card) : '';
  };

  const reorder = (documentId: number, to: number) => {
    const order = arrayMove(ids, ids.indexOf(documentId), to);
    drop(order);
    move.mutate({ documentId, order });
  };

  const step = (card: DocumentHomeCard, direction: -1 | 1) => {
    const to = ids.indexOf(card.page.id) + direction;
    reorder(card.page.id, to);
    setMoved(t('home.pinnedMoved', { title: name(card), place: to + 1, count: ids.length }));
  };

  const dragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    if (!over || active.id === over.id) return;
    reorder(Number(active.id), ids.indexOf(Number(over.id)));
  };

  const dragged = items.find((item) => item.id === activeId)?.card;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={({ active }) => setActiveId(Number(active.id))}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={dragEnd}
      accessibility={{
        announcements: {
          onDragStart: ({ active }) => t('dragStarted', { title: titleOf(active.id) }),
          onDragOver: ({ over }) => (over ? t('dragOver', { title: titleOf(over.id) }) : undefined),
          onDragEnd: ({ over }) =>
            over ? t('dragEnded', { title: titleOf(over.id) }) : t('dragCanceled'),
          onDragCancel: () => t('dragCanceled'),
        },
      }}
    >
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-1 gap-4 @xl:grid-cols-2 @4xl:grid-cols-3">
          {items.map(({ id, card }, index) => (
            <DocumentsHomeCard
              key={id}
              projectKey={projectKey}
              card={card}
              draggable={canPin && !isPhone && !pending}
              menu={
                canPin && (
                  <DocumentsHomeCardMenu
                    title={name(card)}
                    canMoveUp={index > 0}
                    canMoveDown={index < items.length - 1}
                    pending={pending}
                    onMove={(direction) => step(card, direction)}
                    onUnpin={() => pin.setPinned(card.page, false)}
                  />
                )
              }
            />
          ))}
        </div>
      </SortableContext>
      <DragOverlay>{dragged ? <DocumentsHomeCardOverlay page={dragged.page} /> : null}</DragOverlay>
      <p className="sr-only" aria-live="polite">
        {moved}
      </p>
    </DndContext>
  );
}
