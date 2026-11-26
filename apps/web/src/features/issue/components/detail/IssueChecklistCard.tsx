import { useState } from 'react';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus } from 'lucide-react';
import type { Checklist } from '@/lib/api/endpoints/checklists';
import { useDndSensors } from '@/lib/dnd';
import { cn } from '@/lib/utils';
import { CHECKLIST_ITEM_MAX, reorderIds } from '../../utils/checklists';
import {
  useCreateChecklistItem,
  useDeleteChecklist,
  useDeleteChecklistItem,
  useRenameChecklist,
  useReorderChecklistItems,
  useUpdateChecklistItem,
} from '../../services/checklists.service';
import IssueChecklistAddInput from './IssueChecklistAddInput';
import IssueChecklistHeader from './IssueChecklistHeader';
import IssueChecklistItemRow from './IssueChecklistItemRow';
import { useTranslations } from 'next-intl';

// One checklist: its title row and its items.
// The items are sortable within this checklist only — the SortableContext holds just
// its own item ids, so a row cannot be dragged into a different checklist.
export default function IssueChecklistCard({
  issueId,
  checklist,
  canEdit,
  showCount,
}: {
  issueId: number;
  checklist: Checklist;
  canEdit: boolean;
  showCount: boolean;
}) {
  const t = useTranslations('issue.checklists');
  const [adding, setAdding] = useState(false);
  const sensors = useDndSensors();
  const renameChecklist = useRenameChecklist();
  const deleteChecklist = useDeleteChecklist();
  const createItem = useCreateChecklistItem();
  const updateItem = useUpdateChecklistItem();
  const deleteItem = useDeleteChecklistItem();
  const reorderItems = useReorderChecklistItems();

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: checklist.id,
    disabled: !canEdit,
  });

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over) return;
    const orderedIds = reorderIds(checklist.items, Number(active.id), Number(over.id));
    if (orderedIds) reorderItems.mutate({ issueId, checklistId: checklist.id, orderedIds });
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('group/list', isDragging && 'opacity-40')}
    >
      <IssueChecklistHeader
        checklist={checklist}
        canEdit={canEdit}
        showCount={showCount}
        attributes={attributes}
        listeners={listeners}
        onRename={(title) => renameChecklist.mutate({ issueId, checklistId: checklist.id, title })}
        onDelete={() => deleteChecklist.mutate({ issueId, checklistId: checklist.id })}
      />

      <div className="-mx-2">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={checklist.items.map((item) => item.id)}
            strategy={verticalListSortingStrategy}
          >
            {checklist.items.map((item) => (
              <IssueChecklistItemRow
                key={item.id}
                item={item}
                canEdit={canEdit}
                onToggle={(done) =>
                  updateItem.mutate({
                    issueId,
                    checklistId: checklist.id,
                    itemId: item.id,
                    patch: { done },
                  })
                }
                onRename={(content) =>
                  updateItem.mutate({
                    issueId,
                    checklistId: checklist.id,
                    itemId: item.id,
                    patch: { content },
                  })
                }
                onRemove={() => deleteItem.mutate({ issueId, itemId: item.id })}
              />
            ))}
          </SortableContext>
        </DndContext>

        {canEdit &&
          (adding ? (
            <div className="px-2 py-0.5">
              <IssueChecklistAddInput
                placeholder={t('addItem')}
                maxLength={CHECKLIST_ITEM_MAX}
                onSubmit={(content) =>
                  createItem.mutate({ issueId, checklistId: checklist.id, content })
                }
                onClose={() => setAdding(false)}
              />
            </div>
          ) : (
            <button
              type="button"
              className="flex min-h-8 w-full items-center gap-2.5 rounded-md px-2 text-start text-[13px] text-muted-foreground/70 hover:bg-accent/50 hover:text-foreground"
              onClick={() => setAdding(true)}
            >
              <Plus className="size-4" />
              {t('addItemButton')}
            </button>
          ))}
      </div>
    </div>
  );
}
