import { type useSortable } from '@dnd-kit/sortable';
import { GripVertical } from 'lucide-react';
import { useTranslations } from 'next-intl';

// Taken from useSortable's own return type: dnd-kit does not export the listener
// map type from its package root, and reaching into its dist/ internals for it
// would break on any repackaging.
type Sortable = ReturnType<typeof useSortable>;

// The drag handle of a checklist or one of its items. The row itself is the
// sortable node and this is its handle, so the checkbox and the inline text stay
// clickable. A phone has no hover, so there it stays shown, in the row itself.
export default function IssueChecklistGrip({
  canEdit,
  attributes,
  listeners,
  className,
}: {
  canEdit: boolean;
  attributes: Sortable['attributes'];
  listeners: Sortable['listeners'];
  className: string;
}) {
  const t = useTranslations('issue.checklists');
  if (!canEdit) return null;

  return (
    <button
      type="button"
      {...attributes}
      {...listeners}
      className={`absolute top-1/2 -translate-y-1/2 cursor-grab touch-none text-muted-foreground/50 opacity-0 focus-visible:opacity-100 max-sm:static max-sm:translate-y-0 max-sm:opacity-100 ${className}`}
      title={t('dragToReorder')}
    >
      <GripVertical className="size-4" />
    </button>
  );
}
