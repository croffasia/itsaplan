'use client';

import { useState } from 'react';
import {
  Archive,
  ArrowDown,
  ArrowUp,
  Ellipsis,
  FilePlus2,
  FolderInput,
  Pin,
  PinOff,
  Star,
  StarOff,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ProjectDocumentSummary } from '@/lib/api/endpoints/documents';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { DocumentPlacement } from '../../utils/documentMove';
import DocumentIconButton from '../DocumentIconButton';
import DocumentMoveDialog from '../DocumentMoveDialog';

export default function DocumentRowMenu({
  projectKey,
  document,
  canCreate,
  canPin,
  canMove,
  canArchive,
  canStepUp,
  canStepDown,
  pending,
  onCreate,
  onPinChange,
  onFavoriteChange,
  onStep,
  onMoveTo,
  onArchive,
}: {
  projectKey: string;
  document: ProjectDocumentSummary;
  canCreate: boolean;
  canPin: boolean;
  canMove: boolean;
  canArchive: boolean;
  canStepUp: boolean;
  canStepDown: boolean;
  pending: boolean;
  onCreate: () => void;
  onPinChange: () => void;
  onFavoriteChange: () => void;
  onStep: (direction: -1 | 1) => void;
  onMoveTo: (move: DocumentPlacement, parent: ProjectDocumentSummary | null) => void;
  onArchive: () => void;
}) {
  const t = useTranslations('documents');
  const [moveOpen, setMoveOpen] = useState(false);
  const title = document.title.trim() || t('untitled');
  const locked = document.isLocked;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <DocumentIconButton
            label={t('more')}
            aria-label={t('rowActions', { title })}
            className="size-6"
          >
            <Ellipsis />
          </DocumentIconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-56">
          {canCreate && (
            <DropdownMenuItem onSelect={onCreate}>
              <FilePlus2 />
              {t('addSubpage')}
            </DropdownMenuItem>
          )}
          {canPin && (
            <div title={document.isPrivate ? t('pinPrivateHint') : undefined}>
              <DropdownMenuItem disabled={pending || document.isPrivate} onSelect={onPinChange}>
                {document.isPinned ? <PinOff /> : <Pin />}
                {document.isPinned ? t('unpinPage') : t('pinPage')}
              </DropdownMenuItem>
            </div>
          )}
          <DropdownMenuItem onSelect={onFavoriteChange}>
            {document.isFavorite ? <StarOff /> : <Star />}
            {document.isFavorite ? t('removeFavorite') : t('addFavorite')}
          </DropdownMenuItem>
          {canMove && (
            <>
              <DropdownMenuSeparator />
              <div title={locked ? t('unlockToMove') : undefined}>
                <DropdownMenuItem
                  disabled={locked || pending || !canStepUp}
                  onSelect={() => onStep(-1)}
                >
                  <ArrowUp />
                  {t('moveUp')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={locked || pending || !canStepDown}
                  onSelect={() => onStep(1)}
                >
                  <ArrowDown />
                  {t('moveDown')}
                </DropdownMenuItem>
                <DropdownMenuItem disabled={locked || pending} onSelect={() => setMoveOpen(true)}>
                  <FolderInput />
                  {t('moveTo')}
                </DropdownMenuItem>
              </div>
            </>
          )}
          {canArchive && (
            <>
              <DropdownMenuSeparator />
              <div title={locked ? t('unlockToArchive') : undefined}>
                <DropdownMenuItem disabled={locked || pending} onSelect={onArchive}>
                  <Archive />
                  {t('archive')}
                </DropdownMenuItem>
              </div>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {moveOpen && (
        <DocumentMoveDialog
          projectKey={projectKey}
          documentId={document.id}
          onPick={(move, parent) => {
            setMoveOpen(false);
            onMoveTo(move, parent);
          }}
          onClose={() => setMoveOpen(false)}
        />
      )}
    </>
  );
}
