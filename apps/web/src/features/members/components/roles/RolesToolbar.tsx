'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardPaste, Copy, MoreHorizontal, Plus } from 'lucide-react';
import { toast } from 'sonner';
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
import { usePermissionCatalogQuery, useRolesQuery } from '@/services/roles.service';
import RoleEditorPanel from './RoleEditorPanel';
import RolesImportDialog from './RolesImportDialog';
import {
  parseRolesText,
  planRolesImport,
  serializeRoles,
  type PlannedRole,
} from '../../utils/rolesTransfer';

// The Roles page header actions: create a role, and copy/paste the project's roles to
// and from the clipboard (with Cmd/Ctrl+C/V shortcuts). Owner-only; a non-owner sees
// nothing here (the table below shows the access notice). Self-contained — it shares
// the roles/catalog queries with the table through React Query.
export default function RolesToolbar({ projectKey }: { projectKey: string }) {
  const { isOwner } = usePermissions();
  const mod = useIsMac() ? '⌘' : 'Ctrl';
  const rolesQuery = useRolesQuery(projectKey, isOwner);
  const catalogQuery = usePermissionCatalogQuery();
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState<PlannedRole[] | null>(null);

  const roles = useMemo(() => rolesQuery.data ?? [], [rolesQuery.data]);
  const catalog = catalogQuery.data ?? null;
  const customRoleCount = roles.filter((r) => !r.isDefault).length;

  // Copies the project's non-default roles to the clipboard as JSON.
  const copyRoles = useCallback(async () => {
    if (customRoleCount === 0) {
      toast.info('No custom roles to copy.');
      return;
    }
    try {
      await navigator.clipboard.writeText(serializeRoles(roles));
      toast.success(`Copied ${customRoleCount} role${customRoleCount === 1 ? '' : 's'}.`);
    } catch {
      toast.error('Could not copy to the clipboard.');
    }
  }, [roles, customRoleCount]);

  // Reads roles from the clipboard, then opens the confirmation dialog.
  const pasteRoles = useCallback(async () => {
    if (!catalog) return;
    let text: string;
    try {
      text = await navigator.clipboard.readText();
    } catch {
      toast.error('Could not read the clipboard.');
      return;
    }
    try {
      const parsed = parseRolesText(text, catalog);
      setImporting(planRolesImport(parsed, roles));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not read roles from the clipboard.');
    }
  }, [catalog, roles]);

  // Cmd/Ctrl+C copies, Cmd/Ctrl+V pastes — but only on this page, not while typing,
  // not while a dialog or the role editor is open (it can be opened from the table
  // below, outside this component's state), and Cmd+C only when no text is selected
  // (so an intentional text copy still works).
  useEffect(() => {
    if (!isOwner) return;
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
      if (document.querySelector('[data-role-editor], [role="dialog"]')) return;
      if (key === 'c') {
        if ((window.getSelection()?.toString() ?? '') !== '') return;
        e.preventDefault();
        void copyRoles();
      } else {
        e.preventDefault();
        void pasteRoles();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOwner, copyRoles, pasteRoles]);

  if (!isOwner) return null;

  return (
    <div className="flex items-center gap-1.5">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-foreground"
            aria-label="Role import and export"
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={() => void copyRoles()} disabled={customRoleCount === 0}>
            <Copy className="size-4" />
            Copy roles
            <DropdownMenuShortcut>{mod}C</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void pasteRoles()} disabled={!catalog}>
            <ClipboardPaste className="size-4" />
            Paste roles
            <DropdownMenuShortcut>{mod}V</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        size="sm"
        className="h-8 gap-1.5"
        disabled={!catalog}
        onClick={() => setCreating(true)}
      >
        <Plus className="size-3.5" />
        New role
      </Button>

      {creating && catalog && (
        <RoleEditorPanel
          projectKey={projectKey}
          role={null}
          catalog={catalog}
          onClose={() => setCreating(false)}
        />
      )}

      {importing && (
        <RolesImportDialog
          projectKey={projectKey}
          planned={importing}
          onClose={() => setImporting(null)}
        />
      )}
    </div>
  );
}
