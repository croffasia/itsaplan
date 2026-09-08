'use client';

import { LogOut, UserMinus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { MemberRow as Member } from '@/lib/api/endpoints/members';
import type { Role } from '@/lib/api/endpoints/roles';
import { formatDateTime } from '@/utils/dates';
import Avatar from '@/components/common/Avatar';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { usePermissions } from '@/hooks/usePermissions';
import { useSession } from '@/lib/auth-client';
import MemberAgentBadge from './MemberAgentBadge';
import MemberProvisionedBadge from '@/components/common/MemberProvisionedBadge';
import MemberRoleControl from './MemberRoleControl';
import MemberDescription from './MemberDescription';
import MemberDescriptionDialog from './MemberDescriptionDialog';

// One member's row in the members list: identity, role control, and the actions
// (edit description, leave or revoke access). Acting on someone else's membership
// needs the member permission or the standing of an owner or manager of the team
// that runs the project; anyone can leave and describe what they do themselves. The
// last owner cannot be removed, and neither is a membership a provisioned group
// granted — that one changes in the identity provider, and the API refuses it here.
export default function MemberRow({
  projectKey,
  member,
  roles,
  isLastOwner,
  onRemove,
}: {
  projectKey: string;
  member: Member;
  roles: Role[];
  isLastOwner: boolean;
  onRemove: (member: Member) => void;
}) {
  const t = useTranslations('members');
  const { can, isAdmin } = usePermissions();
  const { data: session } = useSession();

  const self = member.userId === session?.user.id;
  // Removing or re-roling a provisioned membership would be undone at the next sync.
  const provisioned = member.source === 'scim';
  const canEdit = can('members_manage', 'edit') || isAdmin;
  // An agent joins and leaves with its AI Agent config, so it cannot be revoked here;
  // its role is set here like a person's.
  const canRemove =
    !member.isAgent && !provisioned && (self || can('members_manage', 'delete') || isAdmin);
  const canEditDescription = !member.isAgent && (self || canEdit);
  const removeLabel = self ? t('leaveProject') : t('revokeAccess');
  const displayName = member.name || member.email;

  return (
    <TableRow className="group/item">
      <TableCell className="px-3 py-3 align-top whitespace-normal">
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <Avatar
              name={displayName}
              image={member.image}
              className="size-8 shrink-0 text-[11px]"
            />
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="flex items-center gap-2 text-sm font-medium">
                <span className="truncate">{displayName}</span>
                {self && (
                  <span className="text-xs font-normal text-muted-foreground">{t('you')}</span>
                )}
                {provisioned && <MemberProvisionedBadge />}
              </span>
              <span className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                {member.isAgent ? (
                  <MemberAgentBadge />
                ) : (
                  <>
                    {member.username && (
                      <>
                        <span className="truncate">@{member.username}</span>
                        <span>·</span>
                      </>
                    )}
                    <span className="truncate">{member.email}</span>
                  </>
                )}
              </span>
            </div>
          </div>
          <MemberDescription member={member} />
        </div>
      </TableCell>
      <TableCell className="px-3 pt-4 pb-3 align-top whitespace-normal">
        <MemberRoleControl
          projectKey={projectKey}
          member={member}
          roles={roles}
          canManage={canEdit && !self && !provisioned}
          canGrantOwner={isAdmin}
          isLastOwner={isLastOwner}
        />
      </TableCell>
      <TableCell className="px-3 py-3 align-top text-sm whitespace-normal text-muted-foreground">
        {/* An agent reads no timestamps, so its bot user's zone means nothing. */}
        {member.isAgent ? null : member.timezone}
      </TableCell>
      <TableCell className="px-3 py-3 align-top text-sm whitespace-normal text-muted-foreground">
        {formatDateTime(member.createdAt)}
      </TableCell>
      <TableCell className="px-3 pt-3 pb-2 align-top">
        <div className="flex items-center justify-end gap-1">
          {canEditDescription && (
            <MemberDescriptionDialog projectKey={projectKey} member={member} self={self} />
          )}
          {canRemove && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-destructive"
                  disabled={isLastOwner}
                  aria-label={removeLabel}
                  onClick={() => onRemove(member)}
                >
                  {self ? <LogOut className="size-4" /> : <UserMinus className="size-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isLastOwner ? t('lastOwner') : removeLabel}</TooltipContent>
            </Tooltip>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
