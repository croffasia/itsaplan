'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { type InviteRow as Invite } from '@/lib/api';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';
import { ItemGroup } from '@/components/ui/item';
import { useDeleteInvite, useInvitesQuery, useSendInviteEmail } from '@/services/members.service';
import { usePermissions } from '@/hooks/usePermissions';
import InviteCreateForm from './InviteCreateForm';
import InviteRow from './InviteRow';

// Invite panel shown above the members list. Lists invites that have not been
// accepted or rejected yet, each with a revoke action, and — with create
// permission — the form to invite someone by email. Gated by the members_invite
// matrix: without read it renders nothing.
export default function InvitesManager({ projectKey }: { projectKey: string }) {
  const t = useTranslations('members.invites');
  const { can } = usePermissions();
  const canRead = can('members_invite', 'read');
  const canCreate = can('members_invite', 'create');
  const canDelete = can('members_invite', 'delete');
  const invitesQuery = useInvitesQuery(projectKey, canRead);
  const deleteInvite = useDeleteInvite(projectKey);
  const sendEmail = useSendInviteEmail(projectKey);
  const [target, setTarget] = useState<Invite | null>(null);

  function resendInvite(invite: Invite) {
    sendEmail.mutate(invite.id);
  }

  if (!canRead) return null;

  const pending = (invitesQuery.data ?? []).filter((invite) => invite.status === 'pending');
  if (!canCreate && pending.length === 0) return null;

  return (
    <div>
      {canCreate && <InviteCreateForm projectKey={projectKey} />}

      {pending.length > 0 && (
        <div className="mb-8">
          <div className="mb-1 border-b pb-1 text-xs font-medium text-muted-foreground">
            {t('pendingCount', { count: pending.length })}
          </div>
          <ItemGroup>
            {pending.map((invite) => (
              <InviteRow
                key={invite.id}
                invite={invite}
                onResend={canCreate ? resendInvite : undefined}
                onRevoke={canDelete ? setTarget : undefined}
                resending={sendEmail.isPending && sendEmail.variables === invite.id}
              />
            ))}
          </ItemGroup>
        </div>
      )}

      {canDelete && target && (
        <ConfirmDialog
          title={t('revokeTitle', { email: target.email })}
          confirmLabel={t('revokeConfirm')}
          onConfirm={async () => {
            await deleteInvite.mutateAsync(target.id);
            setTarget(null);
          }}
          onClose={() => setTarget(null)}
        >
          <div className="text-sm text-muted-foreground">{t('revokeDescription')}</div>
        </ConfirmDialog>
      )}
    </div>
  );
}
