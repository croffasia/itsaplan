import { ListChecks, ListX } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSelection } from '../../context/useSelection';

// Column-header toggle that selects or clears every issue id in a column. Renders
// nothing for an empty column. Hidden until the column is hovered or a selection is
// active, so the header stays clean otherwise — needs a `group/column` ancestor for
// the hover reveal.
export function SelectAllToggle({ ids, className }: { ids: number[]; className?: string }) {
  const t = useTranslations('workItems');
  const selection = useSelection();
  if (ids.length === 0) return null;
  const allSelected = ids.every((id) => selection.isSelected(id));
  const label = allSelected ? t('deselectAll') : t('selectAll');
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'size-6 text-muted-foreground',
            allSelected && 'text-primary',
            !selection.isSelecting && !allSelected && 'opacity-0 group-hover/column:opacity-100',
            className,
          )}
          onClick={() => (allSelected ? selection.remove(ids) : selection.add(ids))}
          aria-label={label}
        >
          {allSelected ? <ListX /> : <ListChecks />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
