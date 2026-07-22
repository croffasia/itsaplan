'use client';

import type { MemberRow, Role } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSetMemberRole } from '@/services/members.service';

// Owner is not a custom role, so it sits outside the roles list under this value.
const OWNER_VALUE = 'owner';

// A member's role, shown in the members list. An owner viewing the list gets a
// select to reassign the role — the project's custom roles plus Owner; anyone
// else sees the current role name as a read-only badge. The last owner cannot be
// demoted, so their select is disabled.
export default function MemberRoleControl({
  projectKey,
  member,
  roles,
  canManage,
  isLastOwner,
}: {
  projectKey: string;
  member: MemberRow;
  roles: Role[];
  canManage: boolean;
  isLastOwner: boolean;
}) {
  const setMemberRole = useSetMemberRole(projectKey);
  const isOwnerRow = member.role === 'owner';

  // A null roleId means the member uses the project's default role.
  const defaultRole = roles.find((r) => r.isDefault) ?? null;
  const currentId = member.roleId ?? defaultRole?.id ?? null;
  const currentName = member.roleName ?? defaultRole?.name ?? 'Member';

  if (!canManage) {
    return (
      <Badge
        variant={isOwnerRow ? 'secondary' : 'outline'}
        className="px-1.5 py-0 text-[10px] font-normal"
      >
        {isOwnerRow ? 'Owner' : currentName}
      </Badge>
    );
  }

  const value = isOwnerRow ? OWNER_VALUE : currentId?.toString();

  function onValueChange(next: string) {
    if (next === value) return;
    if (next === OWNER_VALUE) setMemberRole.mutate({ userId: member.userId, role: 'owner' });
    else setMemberRole.mutate({ userId: member.userId, role: 'member', roleId: Number(next) });
  }

  return (
    <Select
      value={value}
      disabled={setMemberRole.isPending || roles.length === 0 || (isOwnerRow && isLastOwner)}
      onValueChange={onValueChange}
    >
      <SelectTrigger
        size="sm"
        className="h-7 w-36 text-xs"
        title={isOwnerRow && isLastOwner ? 'A project must keep at least one owner' : undefined}
      >
        <SelectValue placeholder="Select role" />
      </SelectTrigger>
      <SelectContent>
        {roles.map((r) => (
          <SelectItem key={r.id} value={String(r.id)}>
            {r.name}
          </SelectItem>
        ))}
        <SelectItem value={OWNER_VALUE}>Owner</SelectItem>
      </SelectContent>
    </Select>
  );
}
