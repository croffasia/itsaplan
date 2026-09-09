'use client';

import { useState } from 'react';
import { UserMinus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { PermissionCatalog, Role } from '@/lib/api/endpoints/roles';
import type { TeamProjectMember } from '@/lib/api/endpoints/teams';
import { membershipPermissions } from '@/utils/permissions';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';
import RowAction from '@/components/common/RowAction';
import MemberAccessCard from '@/components/common/permissions/MemberAccessCard';
import MemberDescriptionDialog from '@/features/members/components/members/MemberDescriptionDialog';
import MemberRoleMenu from '@/features/members/components/members/MemberRoleMenu';
import { useRemoveMember } from '@/services/members.service';

// One member of a project the team owns, managed from the team panel: the same card
// the project's own members list shows, plus the role menu, the description dialog
// and the revoke action it offers. An agent joins and leaves with its AI Agent
// config and a provisioned membership is rewritten by the next sync, so neither is
// re-roled or revoked here. Leaving the project yourself is the panel header's
// action, so the reader's own row carries no revoke.
export default function TeamProjectMemberCard({
  projectKey,
  member,
  roles,
  catalog,
  self,
  isLastOwner,
  canEdit,
  canGrantOwner,
  canDelete,
}: {
  projectKey: string;
  member: TeamProjectMember;
  roles: Role[];
  catalog: PermissionCatalog | undefined;
  self: boolean;
  isLastOwner: boolean;
  canEdit: boolean;
  canGrantOwner: boolean;
  canDelete: boolean;
}) {
  const t = useTranslations('members');
  const removeMember = useRemoveMember(projectKey);
  const [confirming, setConfirming] = useState(false);

  // An agent joins and leaves with its AI Agent config, and a provisioned membership is
  // the identity provider's, so neither is revoked here. A provisioned role is theirs
  // too; an agent's role is set here like a person's.
  const provisioned = member.source === 'scim';
  // The last owner cannot be demoted, so their role has nothing left to change.
  const canReassign = canEdit && !self && !provisioned && !isLastOwner;
  const canRevoke = canDelete && !self && !member.isAgent && !provisioned && !isLastOwner;
  const canDescribe = !member.isAgent && (self || canEdit);
  const displayName = member.name || member.email;

  return (
    <>
      <MemberAccessCard
        member={member}
        permissions={membershipPermissions(catalog, roles, member)}
        catalog={catalog}
        actions={
          (canReassign || canDescribe || canRevoke) && (
            <>
              {canReassign && (
                <MemberRoleMenu
                  projectKey={projectKey}
                  member={member}
                  roles={roles}
                  canGrantOwner={canGrantOwner}
                />
              )}
              {canDescribe && (
                <MemberDescriptionDialog projectKey={projectKey} member={member} self={self} />
              )}
              {canRevoke && (
                <RowAction
                  icon={UserMinus}
                  label={t('revokeAccess')}
                  destructive
                  onClick={() => setConfirming(true)}
                />
              )}
            </>
          )
        }
      />

      {confirming && (
        <ConfirmDialog
          title={t('revokeTitle', { name: displayName })}
          confirmLabel={t('revokeAccess')}
          onConfirm={async () => {
            await removeMember.mutateAsync(member.userId);
            setConfirming(false);
          }}
          onClose={() => setConfirming(false)}
        >
          <div className="text-sm text-muted-foreground">
            {t('revokeDescription', { name: displayName })}
          </div>
        </ConfirmDialog>
      )}
    </>
  );
}
