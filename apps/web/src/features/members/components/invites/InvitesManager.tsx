'use client';

import { useState } from 'react';
import { type InviteRow as Invite } from '@/lib/api';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';
import { ItemGroup } from '@/components/ui/item';
import { useDeleteInvite, useInvitesQuery } from '@/services/members.service';
import { usePermissions } from '@/hooks/usePermissions';
import InviteCreateForm from './InviteCreateForm';
import InviteRow from './InviteRow';

// Invite panel shown above the members list. Lists invites that have not been
// accepted or rejected yet, each with a revoke action, and — with create
// permission — the form to invite someone by email. Gated by the members_invite
// matrix: without read it renders nothing.
export default function InvitesManager({ projectKey }: { projectKey: string }) {
  const { can } = usePermissions();
  const canRead = can('members_invite', 'read');
  const canCreate = can('members_invite', 'create');
  const invitesQuery = useInvitesQuery(projectKey, canRead);
  const deleteInvite = useDeleteInvite(projectKey);
  const [target, setTarget] = useState<Invite | null>(null);

  if (!canRead) return null;

  const pending = (invitesQuery.data ?? []).filter((invite) => invite.status === 'pending');
  if (!canCreate && pending.length === 0) return null;

  return (
    <div>
      {canCreate && <InviteCreateForm projectKey={projectKey} />}

      {pending.length > 0 && (
        <div className="mb-8">
          <div className="mb-1 border-b pb-1 text-xs font-medium text-muted-foreground">
            {pending.length} pending invite{pending.length === 1 ? '' : 's'}
          </div>
          <ItemGroup>
            {pending.map((invite) => (
              <InviteRow key={invite.id} invite={invite} onRevoke={setTarget} />
            ))}
          </ItemGroup>
        </div>
      )}

      {target && (
        <ConfirmDialog
          title={`Revoke invite for ${target.email}`}
          confirmLabel="Revoke invite"
          onConfirm={async () => {
            await deleteInvite.mutateAsync(target.id);
            setTarget(null);
          }}
          onClose={() => setTarget(null)}
        >
          <div className="text-sm text-muted-foreground">
            The invite link will stop working. You can invite this email again later.
          </div>
        </ConfirmDialog>
      )}
    </div>
  );
}
