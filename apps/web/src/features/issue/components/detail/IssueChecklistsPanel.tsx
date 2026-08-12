import { useState } from 'react';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { type IssueWithWatchers } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { useDndSensors } from '@/lib/dnd';
import { CHECKLIST_TITLE_MAX, checklistProgress, reorderIds } from '../../utils/checklists';
import { usePersistedOpen } from '../../hooks/usePersistedOpen';
import { useCreateChecklist, useReorderChecklists } from '../../services/checklists.service';
import IssueChecklistAddInput from './IssueChecklistAddInput';
import IssueChecklistCard from './IssueChecklistCard';
import IssueSectionHeading from './IssueSectionHeading';
import { useTranslations } from 'next-intl';

// The issue's checklists: lists of small steps that do not warrant subtasks of
// their own. The tally counts every item of every checklist, so the heading says
// how much of the card is done without expanding it.
export default function IssueChecklistsPanel({ issue }: { issue: IssueWithWatchers }) {
  const tCommon = useTranslations('common');
  const t = useTranslations('issue.checklists');
  const { can } = usePermissions();
  const canEdit = can('work_items', 'edit');
  const [adding, setAdding] = useState(false);
  const { open, toggle } = usePersistedOpen('issue-checklists-open');
  const sensors = useDndSensors();
  const createChecklist = useCreateChecklist();
  const reorderChecklists = useReorderChecklists();

  const checklists = issue.checklists;
  const progress = checklistProgress(checklists);
  const tally = progress.total > 0 ? `${progress.done}/${progress.total}` : undefined;

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over) return;
    const orderedIds = reorderIds(checklists, Number(active.id), Number(over.id));
    if (orderedIds) reorderChecklists.mutate({ issueId: issue.id, orderedIds });
  }

  return (
    <div className={`mt-6 border-t pt-5 ${open ? '' : '-mb-2'}`}>
      <div className={`flex h-7 items-center justify-between gap-3 ${open ? 'mb-3' : ''}`}>
        <IssueSectionHeading label={t('title')} open={open} onToggle={toggle} tally={tally} />
        {open && canEdit && !adding && (
          <Button variant="ghost" size="sm" className="h-7 gap-1.5" onClick={() => setAdding(true)}>
            <Plus className="size-4" /> {tCommon('add')}
          </Button>
        )}
      </div>

      {open && (
        <>
          {checklists.length === 0 && !adding ? (
            <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
              {canEdit ? t('emptyHint') : t('empty')}
            </p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={checklists.map((checklist) => checklist.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="flex flex-col gap-2">
                  {checklists.map((checklist) => (
                    <IssueChecklistCard
                      key={checklist.id}
                      issueId={issue.id}
                      checklist={checklist}
                      canEdit={canEdit}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          {adding && (
            <div className="mt-2">
              <IssueChecklistAddInput
                placeholder={t('titlePlaceholder')}
                maxLength={CHECKLIST_TITLE_MAX}
                onSubmit={(title) => createChecklist.mutate({ issueId: issue.id, title })}
                onClose={() => setAdding(false)}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
