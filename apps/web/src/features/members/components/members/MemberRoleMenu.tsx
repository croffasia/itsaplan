'use client';

import { Shield } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { MemberRow } from '@/lib/api/endpoints/members';
import type { Role } from '@/lib/api/endpoints/roles';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSetMemberRole } from '@/services/members.service';

// A member's role as one action among the others on their row: an icon opening the
// roles the team assigns from, plus Owner where the reader may hand that rank out, with
// the one they hold checked. An agent is offered the roles without Owner: an owner
// bypasses the matrix, and the API refuses it for an agent. The role itself is stated by the badge beside it, so this only has to
// change it. The select in the members list (MemberRoleControl) is the same write in a
// table cell.
export default function MemberRoleMenu({
  projectKey,
  member,
  roles,
  canGrantOwner,
}: {
  projectKey: string;
  member: Pick<MemberRow, 'userId' | 'role' | 'roleId' | 'isAgent'>;
  roles: Role[];
  // An owner bypasses the matrix, so only a project owner or someone who runs the team
  // promotes to it — the member permission alone does not.
  canGrantOwner: boolean;
}) {
  const t = useTranslations('members');
  const tCommon = useTranslations('common');
  const setMemberRole = useSetMemberRole(projectKey);
  const isOwnerRow = member.role === 'owner';

  // A null roleId means the member uses the project's default role.
  const currentId = member.roleId ?? roles.find((r) => r.isDefault)?.id ?? null;

  function assignRole(roleId: number) {
    if (isOwnerRow || roleId !== currentId) {
      setMemberRole.mutate({ userId: member.userId, role: 'member', roleId });
    }
  }

  function promoteToOwner() {
    if (!isOwnerRow) setMemberRole.mutate({ userId: member.userId, role: 'owner' });
  }

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-foreground"
              disabled={setMemberRole.isPending || roles.length === 0}
              aria-label={t('selectRole')}
            >
              <Shield className="size-4" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>{t('selectRole')}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end">
        {roles.map((r) => (
          <DropdownMenuCheckboxItem
            key={r.id}
            checked={!isOwnerRow && r.id === currentId}
            onSelect={() => assignRole(r.id)}
          >
            {r.name}
          </DropdownMenuCheckboxItem>
        ))}
        {!member.isAgent && canGrantOwner && (
          <DropdownMenuCheckboxItem checked={isOwnerRow} onSelect={promoteToOwner}>
            {tCommon('owner')}
          </DropdownMenuCheckboxItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
