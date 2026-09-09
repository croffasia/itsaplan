'use client';

import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import type { TeamMember, TeamRole } from '@/lib/api/endpoints/teams';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSetTeamMemberRole } from '@/services/teams.service';

// The rank a member holds in the team. An owner or a manager gets a select to change
// it, anyone else reads a badge. An agent keeps the badge as well: its rank is 'agent',
// and what it may do is the role of each project it works in. Nobody changes their own
// rank, and only an owner grants the owner rank or changes what another owner holds.
export default function TeamMemberRoleControl({
  teamId,
  member,
  viewerRole,
  self,
}: {
  teamId: number;
  member: TeamMember;
  viewerRole: TeamMember['role'];
  self: boolean;
}) {
  const t = useTranslations('teams.members');
  const tManage = useTranslations('teams.manage');
  const setRole = useSetTeamMemberRole(teamId);
  const isAgent = member.agentId != null;

  const canManage =
    !isAgent &&
    !self &&
    (viewerRole === 'owner' || (viewerRole === 'manager' && member.role !== 'owner'));

  if (!canManage) {
    return (
      <Badge variant="secondary" className="font-normal">
        {tManage(`roles.${member.role}`)}
      </Badge>
    );
  }

  const ranks: TeamRole[] =
    viewerRole === 'owner' ? ['owner', 'manager', 'member'] : ['manager', 'member'];

  return (
    <Select
      value={member.role}
      disabled={setRole.isPending}
      onValueChange={(role) =>
        setRole.mutate(
          { userId: member.userId, role: role as TeamRole },
          {
            onSuccess: () =>
              toast.success(
                t('roleSaved', { name: member.name, role: tManage(`roles.${role as TeamRole}`) }),
              ),
          },
        )
      }
    >
      <SelectTrigger size="sm" className="h-7 w-32 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ranks.map((rank) => (
          <SelectItem key={rank} value={rank}>
            {tManage(`roles.${rank}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
