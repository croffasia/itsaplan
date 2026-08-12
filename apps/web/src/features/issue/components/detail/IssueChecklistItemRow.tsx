import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { X } from 'lucide-react';
import { type ChecklistItem } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { CHECKLIST_ITEM_MAX } from '../../utils/checklists';
import IssueChecklistEditableText from './IssueChecklistEditableText';
import IssueChecklistGrip from './IssueChecklistGrip';
import { useTranslations } from 'next-intl';

// One checkbox line. The row is the sortable node and the grip is its handle, so
// the checkbox and the text stay clickable while dragging is possible.
export default function IssueChecklistItemRow({
  item,
  canEdit,
  onToggle,
  onRename,
  onRemove,
}: {
  item: ChecklistItem;
  canEdit: boolean;
  onToggle: (done: boolean) => void;
  onRename: (content: string) => void;
  onRemove: () => void;
}) {
  const t = useTranslations('issue.checklists');
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: !canEdit,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'group flex items-center gap-2 rounded-md px-2 py-1 hover:bg-accent/50',
        isDragging && 'opacity-40',
      )}
    >
      <IssueChecklistGrip
        canEdit={canEdit}
        attributes={attributes}
        listeners={listeners}
        className="group-hover:text-muted-foreground"
      />

      <Checkbox
        checked={item.done}
        disabled={!canEdit}
        aria-label={item.content}
        onCheckedChange={(checked) => onToggle(checked === true)}
      />

      <IssueChecklistEditableText
        value={item.content}
        maxLength={CHECKLIST_ITEM_MAX}
        readOnly={!canEdit}
        onCommit={onRename}
        className={cn('text-sm', item.done && 'text-muted-foreground line-through')}
      />

      {canEdit && (
        <Button
          variant="ghost"
          size="icon"
          className="size-6 shrink-0 opacity-0 group-hover:opacity-100 hover:text-destructive"
          aria-label={t('removeItem', { item: item.content })}
          onClick={onRemove}
        >
          <X className="size-3.5" />
        </Button>
      )}
    </div>
  );
}
