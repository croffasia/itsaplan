'use client';

import { useTranslations } from 'next-intl';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { MruEntry } from '../hooks/useNoteBoardMru';
import { boardListIcon } from '../utils/visibility';

// One board tab in the notes header; the active one also carries the board menu.
// Who sees the board is changed on the canvas instead (NoteBoardAccessPicker).
export default function NoteBoardTab({
  tab,
  active,
  onSelect,
  onRename,
  onDelete,
}: {
  tab: MruEntry;
  active: boolean;
  onSelect: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations('notes');
  const tCommon = useTranslations('common');
  const { can } = usePermissions();
  const canEdit = can('note_boards', 'edit');
  const canDelete = can('note_boards', 'delete');
  const showMenu = active && (canEdit || canDelete);
  const Icon = boardListIcon(tab.visibility);

  return (
    <div
      className={cn(
        'flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-sm',
        active
          ? 'bg-secondary font-medium text-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      <button type="button" onClick={onSelect} className="flex items-center gap-1.5">
        <Icon className="size-3.5" />
        {tab.name}
      </button>

      {showMenu && (
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={t('boardOptions')}
            className="text-muted-foreground hover:text-foreground"
          >
            <MoreHorizontal className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {canEdit && (
              <DropdownMenuItem onClick={onRename}>
                <Pencil className="size-4" /> {t('renameBoard')}
              </DropdownMenuItem>
            )}
            {canDelete && (
              <DropdownMenuItem variant="destructive" onClick={onDelete}>
                <Trash2 className="size-4" /> {tCommon('delete')}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
