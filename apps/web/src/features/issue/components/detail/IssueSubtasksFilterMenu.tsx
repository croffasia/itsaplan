import { ListFilter } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { SubtaskStateFilter } from '../../hooks/useSubtaskStateFilter';
import { StateIcon } from '../shared/IssueIcons';

export default function IssueSubtasksFilterMenu({ filter }: { filter: SubtaskStateFilter }) {
  const t = useTranslations('issue.subtasks');
  if (filter.columns.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`size-7 ${filter.hidden.length > 0 ? 'text-primary' : ''}`}
          title={t('filter')}
          aria-label={t('filter')}
        >
          <ListFilter className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {filter.columns.map(({ column, count }) => (
          <DropdownMenuCheckboxItem
            key={column.id}
            checked={filter.isShown(column.id)}
            onCheckedChange={() => filter.toggle(column.id)}
            onSelect={(e) => e.preventDefault()}
          >
            <StateIcon stateType={column.stateType} color={column.color} />
            <span className="flex-1 truncate">{column.name}</span>
            <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
