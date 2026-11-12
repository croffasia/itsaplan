import { ListChecksIcon } from '@animateicons/react/lucide/list-checks-icon';
import { ListXIcon } from '@animateicons/react/lucide/list-x-icon';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { useSelection } from '../../context/useSelection';
import { HeaderIconButton } from '../shared/HeaderIconButton';

// Column-header toggle that selects or clears every issue id in a column. Renders
// nothing for an empty column. Hidden until the column is hovered or a selection is
// active, so the header stays clean otherwise — needs a `group/column` ancestor for
// the hover reveal.
export function SelectAllToggle({ ids, className }: { ids: number[]; className?: string }) {
  const t = useTranslations('workItems');
  const selection = useSelection();
  if (ids.length === 0) return null;
  const allSelected = ids.every((id) => selection.isSelected(id));
  return (
    <HeaderIconButton
      icon={allSelected ? ListXIcon : ListChecksIcon}
      label={allSelected ? t('deselectAll') : t('selectAll')}
      onClick={() => (allSelected ? selection.remove(ids) : selection.add(ids))}
      className={cn(
        allSelected && 'text-primary',
        !selection.isSelecting && !allSelected && 'opacity-0 group-hover/column:opacity-100',
        className,
      )}
    />
  );
}
