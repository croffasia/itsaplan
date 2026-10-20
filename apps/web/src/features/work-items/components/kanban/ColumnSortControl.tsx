import { ArrowDownNarrowWide, ArrowUpNarrowWide, ListOrdered } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { SORT_FIELDS, sortForField, type Sort, type SortField } from '@/utils/viewTypes';

const BOARD_ORDER = 'board';

// Column-header control that orders one column independently of the board. An
// inherited column follows the board ordering from Display; choosing Board ordering
// removes the column's own ordering again.
export function ColumnSortControl({
  columnName,
  sort,
  inherited,
  onChange,
}: {
  columnName: string;
  sort: Sort;
  inherited: boolean;
  onChange: (sort: Sort | null) => void;
}) {
  const t = useTranslations('display.columnOrdering');
  const rowLabel = useTranslations('display.rows');
  const sortLabel = useTranslations('display.sortFields');
  const manual = sort.field === 'manual';
  const direction = sort.dir === 'asc' ? rowLabel('ascending') : rowLabel('descending');
  const label = t('button', { column: columnName, field: sortLabel(sort.field), direction });
  const ascendingActive = !inherited && !manual && sort.dir === 'asc';
  const descendingActive = !inherited && !manual && sort.dir === 'desc';
  let SortIcon = ListOrdered;
  if (!manual) SortIcon = sort.dir === 'asc' ? ArrowUpNarrowWide : ArrowDownNarrowWide;

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn('size-6 text-muted-foreground', !inherited && 'text-primary')}
              aria-label={label}
            >
              <SortIcon />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" collisionPadding={12} className="w-64 p-3">
        <p className="mb-2 text-sm font-medium" dir="auto">
          {t('title', { column: columnName })}
        </p>
        <Select
          value={inherited ? BOARD_ORDER : sort.field}
          onValueChange={(value) =>
            onChange(value === BOARD_ORDER ? null : sortForField(value as SortField, sort))
          }
        >
          <SelectTrigger className="w-full" aria-label={t('field')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={BOARD_ORDER}>{t('board')}</SelectItem>
            {SORT_FIELDS.map((field) => (
              <SelectItem key={field} value={field}>
                {sortLabel(field)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Button
            variant={ascendingActive ? 'secondary' : 'ghost'}
            disabled={manual}
            aria-pressed={ascendingActive}
            onClick={() => onChange({ ...sort, dir: 'asc' })}
          >
            <ArrowUpNarrowWide />
            {rowLabel('ascending')}
          </Button>
          <Button
            variant={descendingActive ? 'secondary' : 'ghost'}
            disabled={manual}
            aria-pressed={descendingActive}
            onClick={() => onChange({ ...sort, dir: 'desc' })}
          >
            <ArrowDownNarrowWide />
            {rowLabel('descending')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
