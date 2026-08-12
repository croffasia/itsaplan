'use client';

import { useCallback, useEffect, useState } from 'react';
import { ClipboardPaste, Copy, MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import type { Label, LabelGroup, PermissionResource } from '@/lib/api';
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
import LabelsImportDialog from './LabelsImportDialog';
import {
  parseLabelsText,
  planLabelsImport,
  serializeLabels,
  type LabelsImportPlan,
} from '../../utils/labelsTransfer';

// The Labels page header actions: copy the project's labels and groups to the
// clipboard and paste them from it (with Cmd/Ctrl+C/V shortcuts). Adding labels is
// done in the list below.
export default function LabelsToolbar({
  projectKey,
  resource,
  groups,
  labels,
}: {
  projectKey: string;
  resource: PermissionResource;
  groups: LabelGroup[];
  labels: Label[];
}) {
  const { can } = usePermissions();
  const t = useTranslations('settings.labels');
  const tTransfer = useTranslations('settings.transfer');
  const transferError = useTransferErrorMessage();
  const mod = useIsMac() ? '⌘' : 'Ctrl';
  const [importing, setImporting] = useState<LabelsImportPlan | null>(null);

  const total = groups.length + labels.length;

  const copyLabels = useCallback(async () => {
    if (total === 0) {
      toast.info(t('nothingToCopy'));
      return;
    }
    try {
      await navigator.clipboard.writeText(serializeLabels(groups, labels));
      toast.success(t('copied', { count: labels.length }));
    } catch {
      toast.error(tTransfer('copyFailed'));
    }
  }, [groups, labels, total, t, tTransfer]);

  const pasteLabels = useCallback(async () => {
    let text: string;
    try {
      text = await navigator.clipboard.readText();
    } catch {
      toast.error(tTransfer('readFailed'));
      return;
    }
    try {
      const parsed = parseLabelsText(text);
      setImporting(planLabelsImport(parsed, groups, labels));
    } catch (err) {
      toast.error(transferError(err, t('parseFailed')));
    }
  }, [groups, labels, t, tTransfer, transferError]);

  // Cmd/Ctrl+C copies, Cmd/Ctrl+V pastes — but only on this page, not while typing,
  // and Cmd+C only when no text is selected (so an intentional text copy still works).
  useEffect(() => {
    if (!can(resource, 'create')) return;
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
        void copyLabels();
      } else {
        e.preventDefault();
        void pasteLabels();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [resource, can, importing, copyLabels, pasteLabels]);

  if (!can(resource, 'create')) return null;

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
          <DropdownMenuItem onClick={() => void copyLabels()} disabled={total === 0}>
            <Copy className="size-4" />
            {t('copy')}
            <DropdownMenuShortcut>{mod}C</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void pasteLabels()}>
            <ClipboardPaste className="size-4" />
            {t('paste')}
            <DropdownMenuShortcut>{mod}V</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {importing && (
        <LabelsImportDialog
          projectKey={projectKey}
          plan={importing}
          existingGroups={groups}
          onClose={() => setImporting(null)}
        />
      )}
    </>
  );
}
