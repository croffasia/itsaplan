'use client';

import { useMemo, useState } from 'react';
import { TriangleAlert, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { PermissionCatalog, Permissions, Role } from '@/lib/api/endpoints/roles';
import { useExitOnEscape } from '@/hooks/useExitOnEscape';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { matrixFromCatalog, permissionGaps } from '@/utils/permissions';
import RoleEditorMatrix from './RoleEditorMatrix';

// Create or edit a role in a right-hand side panel: a team's role or a system role,
// whichever `onSave` writes. Escape or a backdrop click closes it. A role saved before
// the granting order can hold rows out of it: they are marked, and the role is not saved
// until they are fixed. On failure the reason is toasted globally and the panel stays open.
export default function RoleEditorPanel({
  role,
  catalog,
  saving,
  onSave,
  onClose,
}: {
  role: Role | null;
  catalog: PermissionCatalog;
  saving: boolean;
  onSave: (input: { name: string; permissions: Permissions }) => Promise<unknown>;
  onClose: () => void;
}) {
  const t = useTranslations('permissions');
  const tCommon = useTranslations('common');
  const [name, setName] = useState(role?.name ?? '');
  const [matrix, setMatrix] = useState<Permissions>(() =>
    matrixFromCatalog(catalog, role?.permissions),
  );
  useExitOnEscape(onClose);

  const gaps = useMemo(() => permissionGaps(catalog, matrix), [catalog, matrix]);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      await onSave({ name: trimmed, permissions: matrix });
      onClose();
    } catch {
      // The global handler toasts the reason (e.g. a duplicate name); stay open.
    }
  }

  return (
    <div
      data-role-editor
      className="fixed inset-0 z-50 flex bg-black/20"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="ml-auto flex h-full w-full flex-col border-l bg-card sm:w-[680px] sm:max-w-[92vw]">
        <div className="flex shrink-0 items-center justify-between gap-3 bg-muted/30 px-6 py-4">
          <h2 className="min-w-0 truncate text-base font-semibold">
            {role ? t('editor.titleEdit') : t('editor.titleNew')}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={onClose}
            title={tCommon('close')}
          >
            <X />
          </Button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="role-name">{tCommon('name')}</Label>
            <Input
              id="role-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('editor.namePlaceholder')}
              className="h-9"
            />
          </div>

          {gaps.length > 0 && (
            <Alert className="border-warning/35 bg-warning/10 [&>svg]:text-warning">
              <TriangleAlert />
              <AlertTitle>{t('gaps.title')}</AlertTitle>
              <AlertDescription>{t('gaps.description')}</AlertDescription>
            </Alert>
          )}

          <RoleEditorMatrix catalog={catalog} matrix={matrix} gaps={gaps} onChange={setMatrix} />
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t px-6 py-3">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {tCommon('cancel')}
          </Button>
          <Button onClick={save} disabled={saving || !name.trim() || gaps.length > 0}>
            {role ? t('editor.saveRole') : t('editor.createRole')}
          </Button>
        </div>
      </div>
    </div>
  );
}
