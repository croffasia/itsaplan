import { type useSortable } from '@dnd-kit/sortable';
import { Trash2 } from 'lucide-react';
import type { Checklist } from '@/lib/api/endpoints/checklists';
import { Button } from '@/components/ui/button';
import { CHECKLIST_TITLE_MAX } from '../../utils/checklists';
import IssueChecklistEditableText from './IssueChecklistEditableText';
import IssueChecklistGrip from './IssueChecklistGrip';
import { useTranslations } from 'next-intl';

type Sortable = ReturnType<typeof useSortable>;

// The title row of one checklist: its drag handle, the title edited in place, how
// many of its items are done when the issue has more than one list, and the control
// that deletes the whole list.
export default function IssueChecklistHeader({
  checklist,
  canEdit,
  showCount,
  attributes,
  listeners,
  onRename,
  onDelete,
}: {
  checklist: Checklist;
  canEdit: boolean;
  // With one checklist the section heading already counts its items.
  showCount: boolean;
  attributes: Sortable['attributes'];
  listeners: Sortable['listeners'];
  onRename: (title: string) => void;
  onDelete: () => void;
}) {
  const t = useTranslations('issue.checklists');
  const done = checklist.items.filter((item) => item.done).length;

  return (
    <div className="relative flex min-h-7 items-center gap-2">
      <IssueChecklistGrip
        canEdit={canEdit}
        attributes={attributes}
        listeners={listeners}
        className="-start-6 group-hover/list:opacity-100"
      />

      <IssueChecklistEditableText
        value={checklist.title}
        maxLength={CHECKLIST_TITLE_MAX}
        readOnly={!canEdit}
        onCommit={onRename}
        className="text-[13px] font-medium text-muted-foreground"
      />

      {showCount && checklist.items.length > 0 && (
        <span className="shrink-0 text-xs text-muted-foreground/70 tabular-nums">
          {done}/{checklist.items.length}
        </span>
      )}

      {canEdit && (
        <Button
          variant="ghost"
          size="icon"
          className="size-6 shrink-0 text-muted-foreground/70 opacity-0 group-hover/list:opacity-100 hover:text-destructive focus-visible:opacity-100 max-sm:opacity-100"
          aria-label={t('deleteChecklist', { title: checklist.title })}
          onClick={onDelete}
        >
          <Trash2 className="size-3.5" />
        </Button>
      )}
    </div>
  );
}
