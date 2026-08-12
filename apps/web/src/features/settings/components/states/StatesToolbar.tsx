'use client';

import { useCallback, useEffect, useState } from 'react';
import { ClipboardPaste, Copy, MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import type { Column } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { usePermissions } from '@/hooks/usePermissions';
import { useIsMac } from '@/context/useHotkeys';
import { useTransferErrorMessage } from '../../hooks/useTransferErrorMessage';
import StatesImportDialog from './StatesImportDialog';
import {
  parseStatesText,
  planStatesImport,
  serializeStates,
  type PlannedState,
} from '../../utils/statesTransfer';

// The States page header actions: copy the project's states to the clipboard and
// paste states from it (with Cmd/Ctrl+C/V shortcuts). Shown to users who can create
// states. Creating states is done inline per group in the list below.
export default function StatesToolbar({
  projectKey,
  columns,
}: {
  projectKey: string;
  columns: Column[];
}) {
  const t = useTranslations('settings.states');
  const tTransfer = useTranslations('settings.transfer');
  const transferError = useTransferErrorMessage();
  const { can } = usePermissions();
  const mod = useIsMac() ? '⌘' : 'Ctrl';
  const [importing, setImporting] = useState<PlannedState[] | null>(null);

  const copyStates = useCallback(async () => {
    if (columns.length === 0) {
      toast.info(t('nothingToCopy'));
      return;
    }
    try {
      await navigator.clipboard.writeText(serializeStates(columns));
      toast.success(t('copied', { count: columns.length }));
    } catch {
      toast.error(tTransfer('copyFailed'));
    }
  }, [columns, t, tTransfer]);

  const pasteStates = useCallback(async () => {
    let text: string;
    try {
      text = await navigator.clipboard.readText();
    } catch {
      toast.error(tTransfer('readFailed'));
      return;
    }
    try {
      const parsed = parseStatesText(text);
      setImporting(planStatesImport(parsed, columns));
    } catch (err) {
      toast.error(transferError(err, t('parseFailed')));
    }
  }, [columns, t, tTransfer, transferError]);

  // Cmd/Ctrl+C copies, Cmd/Ctrl+V pastes — but only on this page, not while typing,
  // and Cmd+C only when no text is selected (so an intentional text copy still works).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return;
      const key = e.key.toLowerCase();
      if (key !== 'c' && key !== 'v') return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      )
        return;
      if (importing) return;
      if (key === 'c') {
        if ((window.getSelection()?.toString() ?? '') !== '') return;
        e.preventDefault();
        void copyStates();
      } else {
        e.preventDefault();
        void pasteStates();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [importing, copyStates, pasteStates]);

  if (!can('states', 'create')) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-foreground"
            aria-label={t('menu')}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={() => void copyStates()} disabled={columns.length === 0}>
            <Copy className="size-4" />
            {t('copy')}
            <DropdownMenuShortcut>{mod}C</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void pasteStates()}>
            <ClipboardPaste className="size-4" />
            {t('paste')}
            <DropdownMenuShortcut>{mod}V</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {importing && (
        <StatesImportDialog
          projectKey={projectKey}
          planned={importing}
          onClose={() => setImporting(null)}
        />
      )}
    </>
  );
}
