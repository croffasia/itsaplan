import { CheckCheck, ListFilter, MoreHorizontal, SlidersHorizontal, Trash2 } from 'lucide-react';
import { type NotificationFilters, type NotificationType } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const TYPE_LABELS: { value: NotificationType; label: string }[] = [
  { value: 'assigned', label: 'Assigned' },
  { value: 'mentioned', label: 'Mentioned' },
  { value: 'commented', label: 'Commented' },
  { value: 'state_changed', label: 'Status changed' },
];

// The inbox list header: title with unread count, a type filter, display toggles
// (show read / snoozed), and the bulk-action menu.
export default function InboxToolbar({
  unread,
  filters,
  onFiltersChange,
  onMarkAllRead,
  onDeleteRead,
  onDeleteReadCompleted,
}: {
  unread: number;
  filters: NotificationFilters;
  onFiltersChange: (next: NotificationFilters) => void;
  onMarkAllRead: () => void;
  onDeleteRead: () => void;
  onDeleteReadCompleted: () => void;
}) {
  const selectedTypes = filters.types ?? [];

  const toggleType = (type: NotificationType) => {
    const next = selectedTypes.includes(type)
      ? selectedTypes.filter((t) => t !== type)
      : [...selectedTypes, type];
    onFiltersChange({ ...filters, types: next.length ? next : undefined });
  };

  return (
    <div className="flex items-center justify-between border-b px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold">Inbox</span>
        {unread > 0 && <span className="text-xs text-muted-foreground">{unread}</span>}
      </div>
      <div className="flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7" title="Filter">
              <ListFilter />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Notification type</DropdownMenuLabel>
            {TYPE_LABELS.map((t) => (
              <DropdownMenuCheckboxItem
                key={t.value}
                checked={selectedTypes.includes(t.value)}
                onCheckedChange={() => toggleType(t.value)}
                onSelect={(e) => e.preventDefault()}
              >
                {t.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7" title="Display">
              <SlidersHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuCheckboxItem
              checked={filters.includeRead !== false}
              onCheckedChange={(v) => onFiltersChange({ ...filters, includeRead: v })}
              onSelect={(e) => e.preventDefault()}
            >
              Show read
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={filters.includeSnoozed === true}
              onCheckedChange={(v) => onFiltersChange({ ...filters, includeSnoozed: v })}
              onSelect={(e) => e.preventDefault()}
            >
              Show snoozed
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7" title="More">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onMarkAllRead}>
              <CheckCheck />
              Mark all as read
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onDeleteRead}>
              <Trash2 />
              Delete all read
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onDeleteReadCompleted}>
              <Trash2 />
              Delete all read for completed issues
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
