'use client';

import { ArrowDown, ArrowUp, Ellipsis, PinOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { noDragProps } from '@/lib/dnd';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import DocumentIconButton from '../DocumentIconButton';

// The menu in the corner of a pinned card. Move up and Move down step the card one place, the
// way to reorder on a phone and from the keyboard.
export default function DocumentsHomeCardMenu({
  title,
  canMoveUp,
  canMoveDown,
  pending,
  onMove,
  onUnpin,
}: {
  title: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  pending: boolean;
  onMove: (direction: -1 | 1) => void;
  onUnpin: () => void;
}) {
  const t = useTranslations('documents');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <DocumentIconButton
          label={t('more')}
          aria-label={t('rowActions', { title })}
          className="absolute end-3 top-3 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 aria-expanded:opacity-100 [@media(hover:none)]:opacity-100"
          {...noDragProps}
        >
          <Ellipsis />
        </DocumentIconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuItem disabled={pending || !canMoveUp} onSelect={() => onMove(-1)}>
          <ArrowUp />
          {t('moveUp')}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={pending || !canMoveDown} onSelect={() => onMove(1)}>
          <ArrowDown />
          {t('moveDown')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={pending} onSelect={onUnpin}>
          <PinOff />
          {t('unpinPage')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
