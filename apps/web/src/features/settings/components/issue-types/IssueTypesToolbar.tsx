'use client';

import { useCallback, useEffect, useState } from 'react';
import { ClipboardPaste, Copy, MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import type { IssueType, PermissionResource } from '@/lib/api';
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
import { SettingsHeaderAddButton } from '../crud/SettingsHeaderAddButton';
import IssueTypesImportDialog from './IssueTypesImportDialog';
import {
  parseIssueTypesText,
  planIssueTypesImport,
  serializeIssueTypes,
  type PlannedIssueType,
} from '../../utils/issueTypesTransfer';

// The Issue types page header actions: a copy/paste menu (like States) and the primary
// "Add type" button (which opens the inline add form in the list via onAdd).
export default function IssueTypesToolbar({
  projectKey,
  resource,
  types,
  onAdd,
}: {
  projectKey: string;
  resource: PermissionResource;
  types: IssueType[];
  onAdd: () => void;
}) {
  const { can } = usePermissions();
  const mod = useIsMac() ? '⌘' : 'Ctrl';
  const [importing, setImporting] = useState<PlannedIssueType[] | null>(null);

  const copyTypes = useCallback(async () => {
    if (types.length === 0) {
      toast.info('No issue types to copy.');
      return;
    }
    try {
      await navigator.clipboard.writeText(serializeIssueTypes(types));
      toast.success(`Copied ${types.length} issue type${types.length === 1 ? '' : 's'}.`);
    } catch {
      toast.error('Could not copy to the clipboard.');
    }
  }, [types]);

  const pasteTypes = useCallback(async () => {
    let text: string;
    try {
      text = await navigator.clipboard.readText();
    } catch {
      toast.error('Could not read the clipboard.');
      return;
    }
    try {
      const parsed = parseIssueTypesText(text);
      setImporting(planIssueTypesImport(parsed, types));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Could not read issue types from the clipboard.',
      );
    }
  }, [types]);

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
        void copyTypes();
      } else {
        e.preventDefault();
        void pasteTypes();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [resource, can, importing, copyTypes, pasteTypes]);

  return (
    <div className="flex items-center gap-1.5">
      {can(resource, 'create') && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-foreground"
              aria-label="Issue type import and export"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => void copyTypes()} disabled={types.length === 0}>
              <Copy className="size-4" />
              Copy issue types
              <DropdownMenuShortcut>{mod}C</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void pasteTypes()}>
              <ClipboardPaste className="size-4" />
              Paste issue types
              <DropdownMenuShortcut>{mod}V</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <SettingsHeaderAddButton resource={resource} label="Add type" onClick={onAdd} />

      {importing && (
        <IssueTypesImportDialog
          projectKey={projectKey}
          planned={importing}
          onClose={() => setImporting(null)}
        />
      )}
    </div>
  );
}
