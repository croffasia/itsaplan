'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Role } from '@/lib/api/endpoints/roles';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDeleteRole, useRoleUsageQuery } from '@/services/roles.service';

// Deleting a role that members, agents, pending invites or provisioned group mappings
// are on moves them to another role first — the API refuses the deletion without one,
// so the dialog asks for it here. A role nothing is on is deleted straight away.
export default function DeleteRoleDialog({
  teamId,
  role,
  roles,
  onClose,
}: {
  teamId: number;
  role: Role;
  roles: Role[];
  onClose: () => void;
}) {
  const t = useTranslations('teams.roles');
  const deleteRole = useDeleteRole(teamId);
  const { data: usage } = useRoleUsageQuery(teamId, role.id);
  const targets = roles.filter((r) => r.id !== role.id);
  const [targetId, setTargetId] = useState<number | null>(
    () => targets.find((r) => r.isDefault)?.id ?? targets[0]?.id ?? null,
  );

  const counts = usage
    ? [
        { label: t('usageMembers'), n: usage.members },
        { label: t('usageAgents'), n: usage.agents },
        { label: t('usageInvites'), n: usage.invites },
        { label: t('usageGroups'), n: usage.groups },
      ].filter((entry) => entry.n > 0)
    : [];
  const inUse = counts.length > 0;

  function body() {
    if (usage == null) {
      return <div className="text-sm text-muted-foreground">{t('usageLoading')}</div>;
    }
    if (!inUse) {
      return <div className="text-sm text-muted-foreground">{t('deleteDescription')}</div>;
    }
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{t('deleteInUse')}</p>
        <ul className="space-y-1 rounded-lg bg-muted/40 p-3 text-sm">
          {counts.map((entry) => (
            <li key={entry.label} className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{entry.label}</span>
              <span className="font-medium tabular-nums">{entry.n}</span>
            </li>
          ))}
        </ul>
        {targets.length === 0 ? (
          <p className="text-sm text-destructive">{t('noTargetRole')}</p>
        ) : (
          <div className="space-y-1.5">
            <span className="text-sm font-medium">{t('moveTo')}</span>
            <Select
              value={targetId === null ? undefined : String(targetId)}
              onValueChange={(next) => setTargetId(Number(next))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('moveToPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {targets.map((r) => (
                  <SelectItem key={r.id} value={String(r.id)}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    );
  }

  return (
    <ConfirmDialog
      title={t('deleteTitle', { name: role.name })}
      confirmLabel={inUse ? t('moveAndDelete') : t('deleteAction')}
      confirmDisabled={usage == null || (inUse && targetId === null)}
      onConfirm={async () => {
        await deleteRole.mutateAsync({
          roleId: role.id,
          targetRoleId: inUse ? targetId! : undefined,
        });
        onClose();
      }}
      onClose={onClose}
    >
      {body()}
    </ConfirmDialog>
  );
}
