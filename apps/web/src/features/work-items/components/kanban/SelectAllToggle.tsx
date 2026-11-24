import { ListChecksIcon } from '@animateicons/react/lucide/list-checks-icon';
import { ListXIcon } from '@animateicons/react/lucide/list-x-icon';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { useSelection } from '../../context/useSelection';
import { SHOW_ON_COLUMN_HOVER } from '../../utils/kanban';
import { HeaderIconButton } from '../shared/HeaderIconButton';

// Column-header toggle that selects or clears every issue id in a column. Renders
// nothing for an empty column. Hidden until the column is hovered or focused, or a
// selection is active, and always shown on touch screens — needs a `group/column`
// ancestor for the reveal.
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
        !selection.isSelecting && !allSelected && SHOW_ON_COLUMN_HOVER,
        className,
      )}
    />
  );
}
