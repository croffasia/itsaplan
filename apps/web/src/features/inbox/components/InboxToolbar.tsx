'use client';

import { CheckCheck, ListFilter, MoreHorizontal, SlidersHorizontal, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { NotificationFilters, NotificationType } from '@/lib/api/endpoints/notifications';
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

const TYPES: NotificationType[] = ['assigned', 'mentioned', 'commented', 'state_changed'];

// The inbox list header: title with unread count, a type filter, display toggles
// (show read / snoozed), and the bulk-action menu.
export default function InboxToolbar({
  unread,
  filters,
  allProjects,
  onAllProjectsChange,
  onFiltersChange,
  onMarkAllRead,
  onDeleteRead,
  onDeleteReadCompleted,
}: {
  unread: number;
  filters: NotificationFilters;
  allProjects: boolean;
  onAllProjectsChange: (enabled: boolean) => void;
  onFiltersChange: (next: NotificationFilters) => void;
  onMarkAllRead: () => void;
  onDeleteRead: () => void;
  onDeleteReadCompleted: () => void;
}) {
  const t = useTranslations('inbox');
  const tCommon = useTranslations('common');
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
        <span className="text-sm font-semibold">{t('title')}</span>
        {unread > 0 && <span className="text-xs text-muted-foreground">{unread}</span>}
        <button
          type="button"
          className="ms-2 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={() => onAllProjectsChange(!allProjects)}
          aria-pressed={allProjects}
          title={t('scopeHint')}
        >
          {allProjects ? t('allProjects') : t('thisProject')}
        </button>
      </div>
      <div className="flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7" title={t('filter')}>
              <ListFilter />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{t('notificationType')}</DropdownMenuLabel>
            {TYPES.map((type) => (
              <DropdownMenuCheckboxItem
                key={type}
                checked={selectedTypes.includes(type)}
                onCheckedChange={() => toggleType(type)}
                onSelect={(e) => e.preventDefault()}
              >
                {t(`types.${type}`)}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7" title={t('display')}>
              <SlidersHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuCheckboxItem
              checked={filters.includeRead !== false}
              onCheckedChange={(v) => onFiltersChange({ ...filters, includeRead: v })}
              onSelect={(e) => e.preventDefault()}
            >
              {t('showRead')}
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={filters.includeSnoozed === true}
              onCheckedChange={(v) => onFiltersChange({ ...filters, includeSnoozed: v })}
              onSelect={(e) => e.preventDefault()}
            >
              {t('showSnoozed')}
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7" title={tCommon('more')}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onMarkAllRead}>
              <CheckCheck />
              {t('markAllRead')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onDeleteRead}>
              <Trash2 />
              {t('deleteAllRead')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onDeleteReadCompleted}>
              <Trash2 />
              {t('deleteAllReadCompleted')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
