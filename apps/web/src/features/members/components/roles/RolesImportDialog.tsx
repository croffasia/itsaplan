'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import Modal from '@/components/common/overlay/Modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PermissionsPopover } from '@/components/common/permissions/PermissionsPopover';
import { useCreateRole, useUpdateRole } from '@/services/roles.service';
import type { PlannedRole } from '../../utils/rolesTransfer';

// Confirms a roles paste before applying it: lists each incoming role, whether it is
// created or overwrites an existing one, and a preview of its permission matrix. On
// confirm, created and overwritten roles are applied; default-name collisions are
// left untouched.
export default function RolesImportDialog({
  projectKey,
  planned,
  onClose,
}: {
  projectKey: string;
  planned: PlannedRole[];
  onClose: () => void;
}) {
  const t = useTranslations('members.roles.import');
  const tCommon = useTranslations('common');
  const createRole = useCreateRole(projectKey);
  const updateRole = useUpdateRole(projectKey);
  const [busy, setBusy] = useState(false);

  const applicable = planned.filter((p) => p.action !== 'skip');

  async function apply() {
    setBusy(true);
    try {
      let created = 0;
      let updated = 0;
      for (const role of planned) {
        if (role.action === 'create') {
          await createRole.mutateAsync({ name: role.name, permissions: role.permissions });
          created += 1;
        } else if (role.action === 'update' && role.existingId != null) {
          await updateRole.mutateAsync({
            roleId: role.existingId,
            patch: { permissions: role.permissions },
          });
          updated += 1;
        }
      }
      const skipped = planned.length - applicable.length;
      toast.success(t('applied', { created, updated, skipped }));
      onClose();
    } catch {
      // The failed mutation is toasted by the global handler; keep the dialog open.
      setBusy(false);
    }
  }

  return (
    <Modal title={t('title')} onClose={onClose} wide>
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">
          {t('summary', { count: applicable.length })}
        </p>
        <div className="max-h-[50vh] divide-y divide-border/60 overflow-y-auto rounded-md border border-border/60">
          {planned.map((role) => (
            <div key={role.name} className="flex items-center gap-3 px-3 py-2.5">
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{role.name}</span>
              <Badge
                variant={role.action === 'skip' ? 'outline' : 'secondary'}
                className="shrink-0 px-1.5 py-0 text-[10px] font-normal"
              >
                {t(`actions.${role.action}`)}
              </Badge>
              <PermissionsPopover permissions={role.permissions} label={t('preview')} />
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {tCommon('cancel')}
          </Button>
          <Button onClick={apply} disabled={busy || applicable.length === 0}>
            {t('apply', { count: applicable.length })}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
