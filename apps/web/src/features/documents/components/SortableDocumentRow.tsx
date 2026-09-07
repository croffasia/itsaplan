'use client';

import type { ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronRight, FileText, GripVertical, LockKeyhole, Plus, Star } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ProjectDocumentSummary } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { documentPath } from '@/utils/paths';

export default function SortableDocumentRow({
  projectKey,
  document,
  depth,
  active,
  collapsed,
  hasChildren,
  nested,
  canCreate,
  reorderEnabled,
  favoritePending,
  children,
  onToggle,
  onCreate,
  onFavoriteChange,
}: {
  projectKey: string;
  document: ProjectDocumentSummary;
  depth: number;
  active: boolean;
  collapsed: boolean;
  hasChildren: boolean;
  nested: boolean;
  canCreate: boolean;
  reorderEnabled: boolean;
  favoritePending: boolean;
  children?: ReactNode;
  onToggle: () => void;
  onCreate: () => void;
  onFavoriteChange: () => void;
}) {
  const t = useTranslations('documents');
  const draggable = reorderEnabled && !document.isLocked;
  const sortable = useSortable({ id: document.id, disabled: !draggable });
  const title = document.title.trim() || t('untitled');
  const style = {
    transform: CSS.Translate.toString(sortable.transform),
    transition: sortable.transition,
    paddingInlineStart: `${Math.min(depth, 12) * 18}px`,
  };

  return (
    <li
      ref={sortable.setNodeRef}
      style={{ transform: style.transform, transition: style.transition }}
      role="treeitem"
      aria-level={depth + 1}
      aria-selected={active}
      aria-expanded={nested && hasChildren ? !collapsed : undefined}
      className={cn(sortable.isDragging && 'relative z-20')}
    >
      <div style={{ paddingInlineStart: style.paddingInlineStart }}>
        <div
          className={cn(
            'group/row relative flex h-9 items-center rounded-md pe-1 text-[13px] transition-[background-color,box-shadow,opacity] duration-150 outline-none',
            active
              ? 'bg-accent font-medium text-accent-foreground'
              : 'text-foreground focus-within:bg-muted/65 hover:bg-muted/65',
            sortable.isDragging && 'bg-background opacity-90 shadow-lg ring-1 ring-border',
          )}
        >
          <div className="grid size-6 shrink-0 place-items-center">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              disabled={!draggable}
              className={cn(
                'size-6 cursor-grab touch-none text-muted-foreground opacity-0 transition-opacity group-focus-within/row:opacity-100 group-hover/row:opacity-100 active:cursor-grabbing',
                !draggable && 'invisible',
              )}
              aria-label={t('movePage', { title })}
              {...sortable.attributes}
              {...sortable.listeners}
            >
              <GripVertical className="size-3.5" />
            </Button>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className={cn(
              'size-6 shrink-0 text-muted-foreground',
              (!nested || !hasChildren) && 'invisible',
            )}
            aria-label={collapsed ? t('expand') : t('collapse')}
            aria-expanded={hasChildren ? !collapsed : undefined}
            onClick={onToggle}
          >
            <ChevronRight
              className={cn(
                'size-3.5 transition-transform duration-150 rtl:rotate-180',
                !collapsed && 'rotate-90 rtl:rotate-90',
              )}
            />
          </Button>

          <Link
            href={documentPath(projectKey, document.id)}
            className="flex min-w-0 flex-1 items-center gap-2 self-stretch rounded-sm pe-2 outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            aria-current={active ? 'page' : undefined}
          >
            <span
              className="grid size-5 shrink-0 place-items-center text-sm text-muted-foreground"
              aria-hidden
            >
              {document.icon ? document.icon : <FileText className="size-3.5" />}
            </span>
            <span className="min-w-0 flex-1 truncate" dir="auto">
              {title}
            </span>
            <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
              {document.isPrivate && <LockKeyhole className="size-3" />}
            </span>
          </Link>

          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            disabled={favoritePending}
            className={cn(
              'size-6 shrink-0 text-muted-foreground opacity-0 transition-[color,opacity] group-focus-within/row:opacity-100 group-hover/row:opacity-100',
              document.isFavorite &&
                'text-amber-500 opacity-100 hover:bg-amber-500/10 hover:text-amber-600 dark:text-amber-400 dark:hover:text-amber-300',
            )}
            aria-label={document.isFavorite ? t('removeFavorite') : t('addFavorite')}
            aria-pressed={document.isFavorite}
            onClick={onFavoriteChange}
          >
            <Star className={cn('size-3.5', document.isFavorite && 'fill-current')} />
          </Button>

          {canCreate && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="size-6 shrink-0 text-muted-foreground opacity-0 transition-opacity group-focus-within/row:opacity-100 group-hover/row:opacity-100"
              aria-label={t('newSubpage', { title })}
              onClick={onCreate}
            >
              <Plus className="size-3.5" />
            </Button>
          )}
        </div>
      </div>
      {children}
    </li>
  );
}
