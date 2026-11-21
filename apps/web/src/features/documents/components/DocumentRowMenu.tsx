'use client';

import { useState } from 'react';
import { ArrowDown, ArrowUp, FolderInput, MoreHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ProjectDocumentSummary } from '@/lib/api/endpoints/documents';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { DocumentPlacement } from '../utils/documentMove';
import DocumentMoveDialog from './DocumentMoveDialog';

export default function DocumentRowMenu({
  projectKey,
  document,
  busy,
  reorderEnabled,
  first,
  last,
  onMoveTo,
  onStep,
}: {
  projectKey: string;
  document: ProjectDocumentSummary;
  busy: boolean;
  reorderEnabled: boolean;
  first: boolean;
  last: boolean;
  onMoveTo: (move: DocumentPlacement, parent: ProjectDocumentSummary | null) => void;
  onStep: (direction: -1 | 1) => void;
}) {
  const t = useTranslations('documents');
  const [moveOpen, setMoveOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="size-9 shrink-0 text-muted-foreground transition-opacity md:size-6 md:opacity-0 md:group-focus-within/row:opacity-100 md:group-hover/row:opacity-100 md:data-[state=open]:opacity-100"
            aria-label={t('rowActions', { title: document.title.trim() || t('untitled') })}
          >
            <MoreHorizontal className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          <DropdownMenuItem disabled={busy} onSelect={() => setMoveOpen(true)}>
            <FolderInput />
            {t('moveTo')}
          </DropdownMenuItem>
          {reorderEnabled && (
            <>
              <DropdownMenuItem disabled={first} onSelect={() => onStep(-1)}>
                <ArrowUp />
                {t('moveUp')}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={last} onSelect={() => onStep(1)}>
                <ArrowDown />
                {t('moveDown')}
              </DropdownMenuItem>
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
