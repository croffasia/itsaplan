'use client';

import { useState } from 'react';
import { CircleAlert, Minus, Plus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import Modal from '@/components/common/overlay/Modal';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { PermissionsPopover } from '@/components/common/permissions/PermissionsPopover';
import { cn } from '@/lib/utils';
import { useCreateRole, useUpdateRole } from '@/services/roles.service';
import type { PlannedRole } from '../../utils/rolesTransfer';

const ACTION_STYLE = {
  create: { Icon: Plus, tint: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  update: { Icon: RefreshCw, tint: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  skip: { Icon: Minus, tint: 'bg-muted text-muted-foreground' },
  invalid: { Icon: CircleAlert, tint: 'bg-warning/10 text-warning' },
} as const;

// Confirms a roles paste before applying it: lists each incoming role, whether it is
// created or overwrites an existing one, and a preview of its permission matrix. On
// confirm, created and overwritten roles are applied; default-name collisions and roles
// out of granting order are left untouched.
export default function RolesImportDialog({
  teamId,
  planned,
  onClose,
}: {
  teamId: number;
  planned: PlannedRole[];
  onClose: () => void;
}) {
  const t = useTranslations('teams.roles.import');
  const tCommon = useTranslations('common');
  const createRole = useCreateRole(teamId);
  const updateRole = useUpdateRole(teamId);
  const [busy, setBusy] = useState(false);

  const isApplied = (p: PlannedRole) => p.action === 'create' || p.action === 'update';
  const applicable = planned.filter(isApplied);

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
    <Modal
      title={t('title')}
      description={t('summary', { count: applicable.length })}
      onClose={onClose}
      wide
      className="pb-3"
    >
      <div className="max-h-[46vh] space-y-2 overflow-y-auto">
        {planned.map((role) => {
          const { Icon, tint } = ACTION_STYLE[role.action];
          const actionLabel = t(`actions.${role.action}`);
          return (
            <div
              key={role.name}
              className={cn(
                'flex items-center gap-2.5 rounded-lg bg-muted/30 px-3 py-2.5',
                !isApplied(role) && 'opacity-60',
              )}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className={cn(
                      'flex size-7 shrink-0 items-center justify-center rounded-md',
                      tint,
                    )}
                  >
                    <Icon className="size-3.5" />
                  </span>
                </TooltipTrigger>
                <TooltipContent>{actionLabel}</TooltipContent>
              </Tooltip>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{role.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{actionLabel}</span>
              <PermissionsPopover permissions={role.permissions} label={t('preview')} />
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-end gap-2 border-t pt-3">
        <Button variant="outline" onClick={onClose} disabled={busy}>
          {tCommon('cancel')}
        </Button>
        <Button onClick={apply} disabled={busy || applicable.length === 0}>
          {t('apply', { count: applicable.length })}
        </Button>
      </div>
    </Modal>
  );
}
