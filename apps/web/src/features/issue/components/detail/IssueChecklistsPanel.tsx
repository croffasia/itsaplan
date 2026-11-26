import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { IssueWithWatchers } from '@/lib/api/endpoints/issues';
import { usePermissions } from '@/hooks/usePermissions';
import { useDndSensors } from '@/lib/dnd';
import { CHECKLIST_TITLE_MAX, checklistProgress, reorderIds } from '../../utils/checklists';
import { usePersistedOpen } from '@/hooks/usePersistedOpen';
import { useCreateChecklist, useReorderChecklists } from '../../services/checklists.service';
import IssueChecklistAddInput from './IssueChecklistAddInput';
import IssueChecklistCard from './IssueChecklistCard';
import IssueSection from './IssueSection';
import IssueSectionAddButton from './IssueSectionAddButton';
import IssueSectionHeading from './IssueSectionHeading';
import { useTranslations } from 'next-intl';

// The issue's checklists: lists of small steps that do not warrant subtasks of
// their own. The tally counts every item of every checklist, so the heading says
// how much of the card is done without expanding it. With no checklist the section
// stays off the page until the person starts one, here or from the issue's add bar.
export default function IssueChecklistsPanel({
  issue,
  adding,
  onAddingChange,
}: {
  issue: IssueWithWatchers;
  // Whether the title input of a new checklist is open. Held by the issue detail,
  // whose add bar opens it too.
  adding: boolean;
  onAddingChange: (adding: boolean) => void;
}) {
  const tCommon = useTranslations('common');
  const t = useTranslations('issue.checklists');
  const { can } = usePermissions();
  const canEdit = can('work_items', 'edit');
  const { open, toggle } = usePersistedOpen('issue-checklists-open');
  const sensors = useDndSensors();
  const createChecklist = useCreateChecklist();
  const reorderChecklists = useReorderChecklists();

  const checklists = issue.checklists;
  // Opening the input from the add bar has to show it, whatever the heading was left at.
  const expanded = open || adding;
  const progress = checklistProgress(checklists);
  const tally = progress.total > 0 ? `${progress.done}/${progress.total}` : undefined;

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over) return;
    const orderedIds = reorderIds(checklists, Number(active.id), Number(over.id));
    if (orderedIds) reorderChecklists.mutate({ issueId: issue.id, orderedIds });
  }

  if (checklists.length === 0 && !adding) return null;

  return (
    <IssueSection collapsed={!expanded}>
      <IssueSectionHeading
        label={t('title')}
        open={expanded}
        onToggle={toggle}
        tally={tally}
        actions={
          expanded &&
          canEdit &&
          !adding && (
            <IssueSectionAddButton label={tCommon('add')} onClick={() => onAddingChange(true)} />
          )
        }
      />

      {expanded && (
        <>
          {checklists.length > 0 && (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={checklists.map((checklist) => checklist.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="flex flex-col gap-4">
                  {checklists.map((checklist) => (
                    <IssueChecklistCard
                      key={checklist.id}
                      issueId={issue.id}
                      checklist={checklist}
                      canEdit={canEdit}
                      showCount={checklists.length > 1}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          {adding && (
            <div className={checklists.length > 0 ? 'mt-4' : ''}>
              <IssueChecklistAddInput
                placeholder={t('titlePlaceholder')}
                maxLength={CHECKLIST_TITLE_MAX}
                onSubmit={(title) => createChecklist.mutate({ issueId: issue.id, title })}
                onClose={() => onAddingChange(false)}
              />
            </div>
          )}
        </>
      )}
    </IssueSection>
  );
}
