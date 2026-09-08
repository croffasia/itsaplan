'use client';

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { TeamMember } from '@/lib/api/endpoints/teams';
import { formatDate } from '@/utils/dates';
import Avatar from '@/components/common/Avatar';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import MemberProvisionedBadge from '@/components/common/MemberProvisionedBadge';
import TeamMemberRoleControl from './TeamMemberRoleControl';

// One row of the team member list. An agent is a member like a person, with two
// differences: it is addressed by its handle rather than an email, and the role column
// names the team role it acts under, not its standing in the team. `onOpen` is set for
// an agent the reader may open, which takes them to its settings. `onRemove` is set for
// a person the reader may drop from the team; a provisioned membership is dropped at the
// identity provider, so it carries none.
export default function TeamMemberRow({
  member,
  teamId,
  viewerRole,
  self,
  onOpen,
  onRemove,
}: {
  member: TeamMember;
  teamId: number;
  viewerRole: TeamMember['role'];
  self: boolean;
  onOpen?: () => void;
  onRemove?: (member: TeamMember) => void;
}) {
  const t = useTranslations('teams.members');
  const displayName = member.name || member.email;
  const isAgent = member.agentId != null;
  const provisioned = member.source === 'scim' && member.role === 'member';
  const canRemove = onRemove != null && !self && !provisioned && viewerRole === 'owner';

  return (
    <TableRow className={onOpen ? 'cursor-pointer' : 'hover:bg-transparent'} onClick={onOpen}>
      <TableCell className="px-3 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar name={displayName} image={member.image} className="size-8 shrink-0 text-[11px]" />
          <div className="min-w-0">
            <p className="flex items-center gap-2 truncate text-sm font-medium">
              <span className="truncate">{displayName}</span>
              {provisioned && <MemberProvisionedBadge />}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {isAgent ? `@${member.username}` : member.email}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell className="px-3 py-3">
        <TeamMemberRoleControl
          teamId={teamId}
          member={member}
          viewerRole={viewerRole}
          self={self}
        />
      </TableCell>
      <TableCell className="px-3 py-3 text-sm text-muted-foreground">
        {formatDate(member.joinedAt)}
      </TableCell>
      <TableCell className="px-3 py-2">
        {canRemove && (
          <div className="flex items-center justify-end">
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-destructive"
              title={t('removeAction')}
              onClick={(event) => {
                event.stopPropagation();
                onRemove(member);
              }}
            >
              <X className="size-4" />
            </Button>
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}
