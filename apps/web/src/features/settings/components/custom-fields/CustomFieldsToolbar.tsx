'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardPaste, Copy, MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import type { CustomField, IssueType, PermissionResource } from '@/lib/api';
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
import CustomFieldsCopyDialog from './CustomFieldsCopyDialog';
import CustomFieldsImportDialog from './CustomFieldsImportDialog';
import {
  parseCustomFieldsText,
  planCustomFieldsImport,
  serializeCustomFields,
  type CustomFieldsImportPlan,
} from '../../utils/customFieldsTransfer';

// The Custom fields page header actions: copy the project's fields (asking whether to
// include the type-scoped ones) and paste them (creating any missing issue types).
export default function CustomFieldsToolbar({
  projectKey,
  resource,
  fields,
  types,
}: {
  projectKey: string;
  resource: PermissionResource;
  fields: CustomField[];
  types: IssueType[];
}) {
  const { can } = usePermissions();
  const mod = useIsMac() ? '⌘' : 'Ctrl';
  const [copyChoice, setCopyChoice] = useState(false);
  const [importing, setImporting] = useState<CustomFieldsImportPlan | null>(null);

  const typeNameById = useMemo(() => new Map(types.map((t) => [t.id, t.name])), [types]);
  const globalCount = fields.filter((f) => f.issueTypeId == null).length;
  const scopedCount = fields.length - globalCount;

  const doCopy = useCallback(
    async (includeTypeScoped: boolean) => {
      try {
        await navigator.clipboard.writeText(
          serializeCustomFields(fields, typeNameById, includeTypeScoped),
        );
        const n = includeTypeScoped ? fields.length : globalCount;
        toast.success(`Copied ${n} field${n === 1 ? '' : 's'}.`);
      } catch {
        toast.error('Could not copy to the clipboard.');
      }
      setCopyChoice(false);
    },
    [fields, typeNameById, globalCount],
  );

  const copyFields = useCallback(async () => {
    if (fields.length === 0) {
      toast.info('No custom fields to copy.');
      return;
    }
    // Only ask when there are type-scoped fields to decide about.
    if (scopedCount > 0) {
      setCopyChoice(true);
      return;
    }
    await doCopy(true);
  }, [fields.length, scopedCount, doCopy]);

  const pasteFields = useCallback(async () => {
    let text: string;
    try {
      text = await navigator.clipboard.readText();
    } catch {
      toast.error('Could not read the clipboard.');
      return;
    }
    try {
      const parsed = parseCustomFieldsText(text);
      setImporting(planCustomFieldsImport(parsed, types, fields));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Could not read custom fields from the clipboard.',
      );
    }
  }, [types, fields]);

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
      if (copyChoice || importing) return;
      if (key === 'c') {
        if ((window.getSelection()?.toString() ?? '') !== '') return;
        e.preventDefault();
        void copyFields();
      } else {
        e.preventDefault();
        void pasteFields();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [resource, can, copyChoice, importing, copyFields, pasteFields]);

  if (!can(resource, 'create')) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-foreground"
            aria-label="Custom field import and export"
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={() => void copyFields()} disabled={fields.length === 0}>
            <Copy className="size-4" />
            Copy custom fields
            <DropdownMenuShortcut>{mod}C</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void pasteFields()}>
            <ClipboardPaste className="size-4" />
            Paste custom fields
            <DropdownMenuShortcut>{mod}V</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {copyChoice && (
        <CustomFieldsCopyDialog
          globalCount={globalCount}
          scopedCount={scopedCount}
          onChoose={(include) => void doCopy(include)}
          onClose={() => setCopyChoice(false)}
        />
      )}

      {importing && (
        <CustomFieldsImportDialog
          projectKey={projectKey}
          plan={importing}
          existingTypes={types}
          onClose={() => setImporting(null)}
        />
      )}
    </>
  );
}
