'use client';

import type { ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronRight, Globe, LockKeyhole, Pin, Plus, Users } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ProjectDocumentSummary } from '@/lib/api/endpoints/documents';
import { cn } from '@/lib/utils';
import { documentPath } from '@/utils/paths';
import DocumentIconButton from '../DocumentIconButton';
import DocumentsRailIcon from '../DocumentsRailIcon';

// The whole row is the drag handle for a pointer. From the keyboard, Space on the link picks
// the page up, and Move up, Move down and Move to in its menu do the same.
export default function SortableDocumentRow({
  projectKey,
  document,
  depth,
  active,
  shared,
  collapsed,
  hasChildren,
  canCreate,
  draggable,
  menu,
  children,
  onToggle,
  onCreate,
}: {
  projectKey: string;
  document: ProjectDocumentSummary;
  depth: number;
  active: boolean;
  shared: boolean;
  collapsed: boolean;
  hasChildren: boolean;
  canCreate: boolean;
  draggable: boolean;
  menu: ReactNode;
  children?: ReactNode;
  onToggle: () => void;
  onCreate: () => void;
}) {
  const t = useTranslations('documents');
  const sortable = useSortable({ id: document.id, disabled: !draggable });
  const title = document.title.trim() || t('untitled');

  return (
    <li
      ref={sortable.setNodeRef}
      style={{
        transform: CSS.Translate.toString(sortable.transform),
        transition: sortable.transition,
      }}
      role="treeitem"
      aria-level={depth + 1}
      aria-selected={active}
      aria-expanded={hasChildren ? !collapsed : undefined}
      className={cn(sortable.isDragging && 'relative z-20')}
    >
      <div
        {...sortable.listeners}
        style={{ paddingInlineStart: `${2 + Math.min(depth, 12) * 14}px` }}
        className={cn(
          'group/row relative flex h-8 items-center rounded-md pe-1 text-sm transition-colors duration-100 hover:bg-accent has-[[data-state=open]]:bg-accent',
          active && 'bg-accent font-medium',
          sortable.isDragging && 'cursor-grabbing bg-accent shadow-[var(--overlay-shadow)]',
        )}
      >
        <button
          type="button"
          className={cn(
            'grid size-5.5 shrink-0 place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-foreground/8 hover:text-foreground',
            !hasChildren && 'invisible',
          )}
          tabIndex={hasChildren ? 0 : -1}
          aria-label={collapsed ? t('expand', { title }) : t('collapse', { title })}
          aria-expanded={hasChildren ? !collapsed : undefined}
          onClick={onToggle}
        >
          <ChevronRight
            className={cn(
              'size-3.5 transition-transform duration-200 rtl:rotate-180',
              !collapsed && 'rotate-90 rtl:rotate-90',
            )}
          />
        </button>

        <Link
          ref={sortable.setActivatorNodeRef}
          href={documentPath(projectKey, document.id)}
          draggable={false}
          aria-describedby={draggable ? sortable.attributes['aria-describedby'] : undefined}
          className="flex h-full min-w-0 flex-1 items-center gap-2 rounded-sm pe-1 outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          aria-current={active ? 'page' : undefined}
        >
          <DocumentsRailIcon icon={document.icon} />
          <span className="min-w-0 flex-1 truncate" dir="auto">
            {title}
          </span>
          <span className="flex shrink-0 gap-1.5 text-muted-foreground group-focus-within/row:hidden group-hover/row:hidden group-has-[[data-state=open]]/row:hidden pointer-coarse:hidden [&_svg]:size-3">
            {document.isPinned && !document.isPrivate && (
              <Pin role="img" aria-label={t('pinnedPage')} />
            )}
            {shared && <Globe role="img" aria-label={t('access.state.link')} />}
            {document.visibility === 'restricted' && (
              <Users role="img" aria-label={t('sharedWithSome')} />
            )}
            {document.visibility === 'private' && (
              <LockKeyhole role="img" aria-label={t('privatePages')} />
            )}
          </span>
        </Link>

        <span className="hidden shrink-0 group-focus-within/row:flex group-hover/row:flex group-has-[[data-state=open]]/row:flex pointer-coarse:flex">
          {canCreate && (
            <DocumentIconButton
              label={t('addSubpage')}
              aria-label={t('newSubpage', { title })}
              className="size-6"
              onClick={onCreate}
            >
              <Plus />
            </DocumentIconButton>
          )}
          {menu}
        </span>
      </div>
      {children}
    </li>
  );
}
