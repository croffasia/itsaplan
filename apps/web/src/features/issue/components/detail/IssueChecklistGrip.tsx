import { type useSortable } from '@dnd-kit/sortable';
import { GripVertical } from 'lucide-react';
import { useTranslations } from 'next-intl';

// Taken from useSortable's own return type: dnd-kit does not export the listener
// map type from its package root, and reaching into its dist/ internals for it
// would break on any repackaging.
type Sortable = ReturnType<typeof useSortable>;

// The drag handle of a checklist or one of its items. The row itself is the
// sortable node and this is its handle, so the checkbox and the inline text stay
// clickable. Without the permission to edit it renders as a spacer, keeping the
// row's columns aligned with the ones that do have a handle.
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
  if (!canEdit) return <span className="-ml-1 size-4" />;

  return (
    <button
      type="button"
      {...attributes}
      {...listeners}
      className={`-ml-1 cursor-grab touch-none text-muted-foreground/50 ${className}`}
      title={t('dragToReorder')}
    >
      <GripVertical className="size-4" />
    </button>
  );
}
